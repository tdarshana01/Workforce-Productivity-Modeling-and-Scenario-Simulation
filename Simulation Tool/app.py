from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
import joblib
import shap
import re

app = Flask(__name__)

# -----------------------------
# Load model & data
# -----------------------------
model = joblib.load("model/xgb_model.pkl")
df = pd.read_csv("data/dataset.csv")
df1 = df.drop('EmpNumber',axis=1)

encoder = joblib.load("model/pipeline.joblib")  # your encoder


# -----------------------------
# Prediction function
# -----------------------------
def predict(data):
    data_encoded = encoder.transform(data)
    return model.predict(data_encoded)


# -----------------------------
# SHAP explainer (Tree-based)
# -----------------------------
explainer = shap.TreeExplainer(model)

VARIABLE_MAP = {
    "experience years in current role": "ExperienceYearsInCurrentRole",
    "total work experience": "TotalWorkExperienceInYears",
    "salary hike": "EmpLastSalaryHikePercent",
    "environment satisfaction": "EmpEnvironmentSatisfaction",
    "experience years at this company": "ExperienceYearsAtThisCompany",
    "training": "TrainingTimesLastYear",
    "hourly rate": "EmpHourlyRate",
    "business travel": "BusinessTravelFrequency",
    "years since last promotion": "YearsSinceLastPromotion",
    "age": "Age"
}

SPECIAL_PHRASES = {
    "overtime": "OverTime",
    "work overtime": "OverTime",
    "employees who work overtime": "OverTime",

    "business travel": "BusinessTravelFrequency",
    "travel frequency": "BusinessTravelFrequency",
    "travel": "BusinessTravelFrequency"
}

SEMANTIC_VALUES = {
    "OverTime": {
        "Yes": ["overtime", "work overtime", "extra hours"],
        "No": ["no overtime", "not working overtime"]
    },

    # ✅ NEW
    "BusinessTravelFrequency": {
        "Travel_Frequently": [
            "travel frequently",
            "frequent travel",
            "travels a lot"
        ],
        "Travel_Rarely": [
            "rarely travel",
            "travel rarely",
            "less travel"
        ],
        "Non-Travel": [
            "no travel",
            "does not travel",
            "non travel",
            "no business travel"
        ]
    }
}

# -----------------------------
# AUTO VARIABLE NAME CLEANING
# -----------------------------
def clean_text(text):
    return re.sub(r'[^a-z0-9 ]', '', text.lower())

def split_camel_case(name):
    return re.sub(r'([a-z])([A-Z])', r'\1 \2', name).lower()

# -----------------------------
# BUILD VARIABLE MAP DYNAMICALLY
# -----------------------------
ALL_VARIABLES = list(df.columns)

VARIABLE_ALIASES = {}

for col in ALL_VARIABLES:
    clean_name = split_camel_case(col)
    VARIABLE_ALIASES[col] = clean_name

def match_variable(text):
    text = clean_text(text)

    for phrase, var in SPECIAL_PHRASES.items():
        if phrase in text:
            return var

    best_match = None
    best_score = 0

    for col, alias in VARIABLE_ALIASES.items():

        score = 0

        # simple word overlap scoring
        text_words = set(text.split())

        for word in alias.split():
            if len(word) > 2 and word in text_words:
                score += 1

        if score > best_score:
            best_score = score
            best_match = col

    return best_match

def detect_categorical_value(variable, text):

    text = text.lower()

    # ✅ SEMANTIC MATCH FIRST
    if variable in SEMANTIC_VALUES:
        for actual_value, phrases in SEMANTIC_VALUES[variable].items():
            for phrase in phrases:
                if phrase in text:
                    return actual_value

    # ✅ FALLBACK (existing logic)
    unique_vals = df[variable].dropna().unique()

    for val in unique_vals:
        if str(val).lower().replace("_", " ") in text:
            return val

    return None

def parse_nlp(text):

    text = text.lower()
    rules = []

    parts = re.split(r'and|,', text)

    for part in parts:

        # -----------------------------
        # SPLIT SENTENCE INTO TARGET + CONDITION
        # -----------------------------
        if "for" in part:
            target_part = part.split("for")[0]
            condition_part = part.split("for")[1]
        else:
            target_part = part
            condition_part = part

        # -----------------------------
        # DETECT TARGET ONLY FROM TARGET PART
        # -----------------------------
        target_variable = match_variable(target_part)
        condition_variable = None
        condition_value = None
        change = 0
        condition = ""

        # CONDITION VARIABLE
        if "for" in part:
            condition_part = part.split("for")[-1]
            condition_variable = match_variable(condition_part)

        if not condition_variable:
            condition_variable = target_variable

        # categorical detection
        condition_value = detect_categorical_value(condition_variable, condition_part)

        # change extraction
        numbers = re.findall(r'[\+\-]?\d+', part)
        if numbers:
            change = int(numbers[0])

        if "decrease" in part or "reduce" in part:
            change = -abs(change)

        # numeric condition
        match = re.search(r'(less than|greater than|<|>)\s*(\d+)', condition_part)

        if match:
            symbol = "<" if "less" in match.group(1) else ">"
            condition = f"{symbol}{match.group(2)}"
            condition_value = None   # ✅ override categorical

        # build rule
        rule = {
            "target_variable": target_variable,
            "condition_variable": condition_variable,
            "change": int(change),
            "condition": str(condition)
        }

        if condition_value is not None:
            rule["condition_value"] = str(condition_value)

        rules.append(rule)

    # -----------------------------
    # REMOVE DUPLICATES (AFTER LOOP)
    # -----------------------------
    unique_rules = []
    seen = set()

    for r in rules:
        key = (
            r.get("target_variable"),
            r.get("condition_variable"),
            r.get("condition"),
            r.get("condition_value"),
            r.get("change")
        )

        if key not in seen:
            seen.add(key)
            unique_rules.append(r)

    return unique_rules

# -----------------------------
# Home route
# -----------------------------
@app.route("/")
def home():
    return render_template("index.html")


# -----------------------------
# Get initial dashboard data
# -----------------------------
@app.route("/get_initial_data")
def get_initial_data():

    department = request.args.get("department", None)
    job_role = request.args.get("job_role", None)

    df_copy = df1.copy()

    if department:
        df_copy = df_copy[
            df_copy["EmpDepartment"].astype(str).str.strip().str.lower()
            == department.strip().lower()
        ]

    if job_role:
        df_copy = df_copy[
            df_copy["EmpJobRole"].astype(str).str.strip().str.lower()
            == job_role.strip().lower()
        ]

    employee_count = int(len(df_copy))

    # -------------------------
    # Encode data ONCE
    # -------------------------
    X_encoded = encoder.transform(df_copy)

    # -------------------------
    # Predictions
    # -------------------------
    predictions = model.predict(X_encoded)
    df_copy["Predicted"] = predictions

    # -------------------------
    # KPI stats
    # -------------------------
    mean_val = float(round(df_copy["PerformanceScore"].mean(), 2))
    min_val = float(round(df_copy["PerformanceScore"].min(), 2))
    max_val = float(round(df_copy["PerformanceScore"].max(), 2))

    # -------------------------
    # Distribution
    # -------------------------
    distribution = [float(x) for x in df_copy["PerformanceScore"].tolist()]

    # -------------------------
    # SHAP (use encoded data!)
    # -------------------------
    
    sample_encoded = X_encoded

    shap_values = explainer.shap_values(sample_encoded)

    # -------------------------
    # Feature importance
    # -------------------------
    shap_importance = np.abs(shap_values).mean(axis=0)
    importance_pct = (shap_importance / shap_importance.sum()) * 100

    # Get feature names from encoder
    try:
        feature_names = encoder.get_feature_names_out()
        feature_names = [name.split("__")[-1] for name in feature_names]
    except:
        feature_names = [f"Feature_{i}" for i in range(len(shap_importance))]

    shap_df = pd.DataFrame({
        "feature": feature_names,
        "importance": importance_pct
    }).sort_values(by="importance", ascending=False)

    top_features = shap_df.head(5)

    influencers = [
        {
            "feature": row["feature"],
            "impact": round(row["importance"], 1)  # percentage
        }
        for _, row in top_features.iterrows()
    ]

    # -------------------------
    # Response
    # -------------------------
    return jsonify({
        "summary": {
            "mean": round(float(mean_val),2),
            "min": round(float(min_val),2),
            "max": round(float(max_val),2),
            "count": employee_count
        },
        "distribution": [float(x) for x in distribution],
        "influencers": influencers
    })


@app.route("/simulate_company", methods=["POST"])
def simulate_company():

    data = request.get_json()
    rules = data.get("rules", [])

    department = data.get("department", None)
    job_role = data.get("job_role", None)

    df_sim = df1.copy()

    if department:
        df_sim = df_sim[df_sim["EmpDepartment"] == department]

    if job_role:
        df_sim = df_sim[df_sim["EmpJobRole"] == job_role]

    # -----------------------------
    # APPLY RULES
    # -----------------------------
    for rule in rules:

        # -----------------------------
        # Detect rule type
        # -----------------------------
        if "target_variable" in rule:
            # 🔹 NLP RULE (cross-variable)
            target = rule["target_variable"]
            cond_var = rule.get("condition_variable", target)
        else:
            # 🔹 MANUAL RULE (existing)
            target = rule["variable"]
            cond_var = target

        change = float(rule["change"])
        condition = rule.get("condition", "")

        # -----------------------------
        # Apply condition (SAFE EXTENSION)
        # -----------------------------

        # default mask
        mask = pd.Series(True, index=df_sim.index)

        # ✅ NEW: categorical condition support
        if "condition_value" in rule:
            try:
                mask = df_sim[cond_var] == rule["condition_value"]
            except:
                pass

        # ✅ EXISTING logic (UNCHANGED)
        elif condition:

            try:

                # -----------------------------
                # SAFE NUMERIC CONDITION
                # -----------------------------
                if condition.startswith("<"):
                    value = float(condition.replace("<", ""))
                    mask = df_sim[cond_var] < value

                elif condition.startswith(">"):
                    value = float(condition.replace(">", ""))
                    mask = df_sim[cond_var] > value

                else:
                    mask = pd.Series(True, index=df_sim.index)

            except:
                mask = pd.Series(True, index=df_sim.index)

        # -----------------------------
        # Apply change ONLY to target
        # -----------------------------
        if target in df_sim.select_dtypes(include=np.number).columns:
            df_sim.loc[mask, target] += change

    # -----------------------------
    # BASELINE
    # -----------------------------
    #X_base = encoder.transform(df)
    base_pred = df_sim['PerformanceScore']
    df_sim1 = df_sim.drop('PerformanceScore',axis=1)

    # -----------------------------
    # SCENARIO
    # -----------------------------
    X_sim = encoder.transform(df_sim1)
    sim_pred = model.predict(X_sim)

    # -----------------------------
    # KPI
    # -----------------------------
    base_mean = round(base_pred.mean(), 2)
    sim_mean = round(sim_pred.mean(), 2)
    impact_pct = ((sim_mean - base_mean) / base_mean) * 100

    # -----------------------------
    # DISTRIBUTION
    # -----------------------------
    return jsonify({
        "baseline_mean": round(float(base_mean),2),
        "scenario_mean": round(float(sim_mean),2),
        "impact": f"{round(float(impact_pct),2)}%",
        "baseline_distribution": base_pred.astype(float).tolist(),
        "scenario_distribution": sim_pred.astype(float).tolist()
    })

@app.route("/get_departments")
def get_departments():

    departments = df["EmpDepartment"].dropna().unique().tolist()

    # Optional: sort
    departments.sort()

    return jsonify(departments)

@app.route("/get_job_roles")
def get_job_roles():
    roles = df["EmpJobRole"].dropna().unique().tolist()
    roles.sort()
    return jsonify(roles)

@app.route("/get_employee")
def get_employee():

    emp_id = request.args.get("emp_id")

    df_emp = df[df["EmpNumber"].astype(str) == str(emp_id)]

    if df_emp.empty:
        return jsonify({"error": "Employee not found"}), 404

    row = df_emp.iloc[0]

    data = row.to_dict()

    # Add display fields
    data["EmpID"] = row["EmpNumber"]
    data["Name"] = "XXXX XXXXX"

    return jsonify(data)

@app.route("/simulate_individual", methods=["POST"])
def simulate_individual():

    data = request.get_json()
    emp_id = data.get("emp_id")
    rules = data.get("rules", [])

    df_emp = df[df["EmpNumber"].astype(str) == str(emp_id)].copy()

    if df_emp.empty:
        return jsonify({"error": "Employee not found"}), 404

    # baseline
    base_score = float(df_emp["PerformanceScore"].values[0])

    # apply rules
    for rule in rules:

        var = rule["variable"]

        if rule["type"] == "numeric":
            df_emp[var] = df_emp[var].astype(float) + float(rule["change"])

        elif rule["type"] == "categorical":
            df_emp[var] = str(rule["value"])

    # predict
    df_emp = df_emp.drop('EmpNumber',axis=1)
    X_sim = encoder.transform(df_emp)
    sim_score = float(model.predict(X_sim)[0])

    impact = ((sim_score - base_score) / base_score) * 100

    return jsonify({
        "baseline": round(base_score, 2),
        "scenario": round(sim_score, 2),
        "impact": f"{round(impact, 2)}%"
    })


@app.route("/nlp_parse", methods=["POST"])
def nlp_parse():

    data = request.get_json()
    text = data.get("text", "")

    rules = parse_nlp(text)

    return jsonify({"rules": rules})

@app.route("/get_variables")
def get_variables():
    return jsonify(df1.columns.tolist())

@app.route("/get_categories")
def get_categories():

    column = request.args.get("column")

    if column not in df.columns:
        return jsonify([])

    values = df[column].dropna().unique().tolist()

    # Convert to string (important)
    values = [str(v) for v in values]

    return jsonify(values)

@app.route("/department")
def department():
    return render_template("department.html")

@app.route("/job_role")
def job_role():
    return render_template("job_role.html")

@app.route("/individual")
def individual():
    return render_template("individual.html")

@app.route("/get_prediction")
def get_prediction():
    return render_template("prediction.html")

@app.route("/predict", methods=["POST"])
def predict_performance():

    data = request.get_json()

    # ✅ Start with full default row
    df_input = df1.iloc[[0]].copy()

    # ✅ Override with user inputs
    for key, value in data.items():
        df_input[key] = value

    try:
        X = encoder.transform(df_input)
        prediction = float(model.predict(X)[0])

        return jsonify({
            "prediction": round(prediction, 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)