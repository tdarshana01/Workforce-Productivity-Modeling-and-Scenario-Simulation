let allVariables = [];

// ==============================
// KPI UPDATE
// ==============================
function updateKPIs(summary) {
    document.getElementById("avgScore").innerText = summary.mean;
    document.getElementById("minScore").innerText = summary.min;
    document.getElementById("maxScore").innerText = summary.max;
    document.getElementById("empCount").innerText = summary.count;
}


// ==============================
// HISTOGRAM
// ==============================
let histChart;

function drawHistogram(values) {

    const ctx = document.getElementById("histogram").getContext("2d");

    if (histChart) histChart.destroy();

    // Create bins (important for histogram)
    const bins = 20;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / bins;

    let counts = new Array(bins).fill(0);

    values.forEach(v => {
        let index = Math.floor((v - min) / step);
        if (index >= bins) index = bins - 1;
        counts[index]++;
    });

    const labels = counts.map((_, i) => (min + i * step).toFixed(1));

    histChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Distribution",
                data: counts
            }]
        }
    });
}

function formatVariableName(name) {
    return name
        .replace(/^Emp/, '')                 // remove "Emp" at start
        .replace(/([A-Z])/g, ' $1')          // space before capitals
        .replace(/\s+/g, ' ')                // clean spaces
        .trim();
}


// ==============================
// INFLUENCERS (SHAP)
// ==============================
function formatFeatureName(name) {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace("Emp", "Employee ")
        .replace(/\s+/g, ' ')
        .trim();
}

function showInfluencers(features) {

    const container = document.getElementById("influencers");
    container.innerHTML = "";

    features.forEach(f => {

        const div = document.createElement("div");

        div.innerHTML = `
            <div style="margin-bottom:8px;">
                <strong>${formatFeatureName(f.feature)}</strong> (${f.impact}%)
                <div style="
                    height:8px;
                    background:#1e293b;
                    border-radius:5px;
                    margin-top:4px;">
                    
                    <div style="
                        width:${f.impact}%;
                        height:100%;
                        background:#38bdf8;
                        border-radius:5px;">
                    </div>

                </div>
            </div>
        `;

        container.appendChild(div);
    });
}

// ==============================
// LOAD INITIAL DATA
// ==============================
window.onload = function () {

    // Load dropdown first
    if (document.getElementById("departmentSelect")) {
        loadDepartments();
    }

    if (document.getElementById("jobRoleSelect")) {
        loadJobRoles();
    }

    if (document.getElementById("individualContent")) {
        loadVariables();
    }

    if (document.getElementById("EmpDepartment")) {
        loadDepartmentsForPrediction();
    }

    if (document.getElementById("EmpJobRole")) {
        loadJobRolesForPrediction();
    }

    // Company page still works normally
    if (document.getElementById("histogram")) {

        fetch("/get_initial_data")
        .then(res => res.json())
        .then(data => {
            updateKPIs(data.summary);
            drawHistogram(data.distribution);
            showInfluencers(data.influencers);
        });
    }
};


// ==============================
// SIMULATION (TEMP - KEEP SIMPLE)
// ==============================
function runSimulation() {

    // -----------------------------
    // 1. MANUAL RULES (UNCHANGED)
    // -----------------------------
    const manualRules = [];

    document.querySelectorAll(".rule").forEach(rule => {
        manualRules.push({
            variable: rule.querySelector(".variable").value,
            change: rule.querySelector(".change").value,
            condition: rule.querySelector(".condition").value
        });
    });

    // -----------------------------
    // 2. NLP RULES (NEW)
    // -----------------------------
    const nlpRules = window.currentNLPRules || [];

    // -----------------------------
    // 3. COMBINE BOTH
    // -----------------------------
    const allRules = [...manualRules, ...nlpRules];

    // -----------------------------
    // 4. FILTERS (UNCHANGED)
    // -----------------------------
    let department = null;

    const deptDropdown = document.getElementById("departmentSelect");
    if (deptDropdown) {
        department = deptDropdown.value;
    }

    let job_role = null;

    const roleDropdown = document.getElementById("jobRoleSelect");
    if (roleDropdown) {
        job_role = roleDropdown.value;
    }

    // -----------------------------
    // 5. API CALL (ONLY CHANGE HERE)
    // -----------------------------
    fetch("/simulate_company", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            rules: allRules,   // ✅ THIS IS THE ONLY REAL CHANGE
            department: department,
            job_role: job_role
        })
    })
    .then(res => res.json())
    .then(res => {

        document.getElementById("baselineAvg").innerText = res.baseline_mean;
        document.getElementById("scenarioAvg").innerText = res.scenario_mean;

        const impactEl = document.getElementById("impact");

        const impactValue = parseFloat(res.impact);

        if (impactValue > 0) {
            impactEl.innerText = "+" + res.impact + " ↑";
            impactEl.style.color = "#22c55e";
        } else if (impactValue < 0) {
            impactEl.innerText = res.impact + " ↓";
            impactEl.style.color = "#ef4444";
        } else {
            impactEl.innerText = res.impact;
            impactEl.style.color = "white";
        }

        drawComparisonHistogram(
            res.baseline_distribution,
            res.scenario_distribution
        );
    });
}

function drawComparison(baseline, scenario) {

    const ctx = document.getElementById("histogram").getContext("2d");

    if (histChart) histChart.destroy();

    histChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: baseline.map((_, i) => i),
            datasets: [
                {
                    label: "Baseline",
                    data: baseline
                },
                {
                    label: "Scenario",
                    data: scenario
                }
            ]
        }
    });
}

let comparisonChart;

function drawComparisonHistogram(baseline, scenario) {

    const ctx = document.getElementById("comparisonChart").getContext("2d");

    if (comparisonChart) comparisonChart.destroy();

    const bins = 20;

    const baseHist = getHistogram(baseline, bins);
    const simHist = getHistogram(scenario, bins);

    // Use SAME x-axis
    const labels = baseHist.binCenters.map(v => v.toFixed(1));

    // KDE using same x values
    const kdeBase = computeKDE(baseline, baseHist.binCenters);
    const kdeSim = computeKDE(scenario, baseHist.binCenters);

    comparisonChart = new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: "bar",
                    label: "Baseline",
                    data: baseHist.counts,
                    backgroundColor: "rgba(59, 130, 246, 0.4)" // light blue
                },
                {
                    type: "bar",
                    label: "Scenario",
                    data: simHist.counts,
                    backgroundColor: "rgba(239, 68, 68, 0.4)" // light red
                },
                {
                    type: "line",
                    label: "Baseline KDE",
                    data: kdeBase,
                    borderColor: "#3b82f6",   // 🔵 Blue
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4
                },
                {
                    type: "line",
                    label: "Scenario KDE",
                    data: kdeSim,
                    borderColor: "#ef4444",   // 🔴 Red
                    borderWidth: 3,
                    borderDash: [6, 4],       
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Performance Score"
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Density"
                    }
                }
            }
        }
    });
}

function addRule() {

    const container = document.getElementById("rules-container");

    const div = document.createElement("div");
    div.classList.add("rule");

    div.innerHTML = `
        <select class="variable">
            <option value="ExperienceYearsInCurrentRole">Experience Years In Current Role</option>
            <option value="TotalWorkExperienceInYears">Total Work Experience</option>
            <option value="EmpLastSalaryHikePercent">Salary Hike %</option>
            <option value="EmpEnvironmentSatisfaction">Environment Satisfaction</option>
            <option value="ExperienceYearsAtThisCompany">Years At Company</option>
            <option value="TrainingTimesLastYear">Training Times Last Year</option>
            <option value="EmpHourlyRate">Hourly Rate</option>
            <option value="Age">Age</option>
        </select>

        <input type="number" class="change" placeholder="+ / -" />

        <input type="text" class="condition" placeholder="Condition (e.g. <5)" />

        <button class="delete-btn">✖</button>
    `;

    // ✅ DELETE RULE LOGIC
    div.querySelector(".delete-btn").addEventListener("click", () => {
        div.remove();
    });

    container.appendChild(div);
}

function computeKDE(data, x_vals, bandwidth = 3) {

    let kde_vals = [];

    x_vals.forEach(x => {

        let sum = 0;

        data.forEach(d => {
            sum += Math.exp(-0.5 * Math.pow((x - d) / bandwidth, 2));
        });

        let density = sum / (data.length * bandwidth * Math.sqrt(2 * Math.PI));

        kde_vals.push(density);
    });

    return kde_vals;
}

function getHistogram(data, bins = 20) {

    const min = Math.min(...data);
    const max = Math.max(...data);
    const step = (max - min) / bins;

    let counts = new Array(bins).fill(0);
    let binCenters = [];

    // create bin centers
    for (let i = 0; i < bins; i++) {
        binCenters.push(min + step * (i + 0.5));
    }

    // count values
    data.forEach(v => {
        let index = Math.floor((v - min) / step);
        if (index >= bins) index = bins - 1;
        counts[index]++;
    });

    // normalize
    counts = counts.map(c => c / data.length);

    return { counts, binCenters, step };
}

function resetSimulation() {

    // -----------------------------
    // 1. Clear manual rules
    // -----------------------------
    document.getElementById("rules-container").innerHTML = "";

    // -----------------------------
    // 2. Clear NLP rules (KEY FIX)
    // -----------------------------
    window.currentNLPRules = [];

    // -----------------------------
    // 3. Clear NLP summary UI
    // -----------------------------
    const summary = document.getElementById("nlpSummary");
    if (summary) summary.innerHTML = "";

    // -----------------------------
    // 4. Clear NLP input box
    // -----------------------------
    const input = document.getElementById("nlpInput");
    if (input) input.value = "";

    // -----------------------------
    // 5. Reset KPI / results (existing)
    // -----------------------------
    if (document.getElementById("baseline")) {
        document.getElementById("baseline").innerText = "-";
        document.getElementById("scenario").innerText = "-";
        document.getElementById("impact").innerText = "-";
        document.getElementById("impact").style.color = "white";
    }

    if (document.getElementById("baselineAvg")) {
        document.getElementById("baselineAvg").innerText = "-";
        document.getElementById("scenarioAvg").innerText = "-";
        document.getElementById("impact").innerText = "-";
    }
}

function loadDepartmentPage() {

    const dept = document.getElementById("departmentSelect").value;

    if (!dept) return;

    // show dashboard
    document.getElementById("dashboardContent").style.display = "block";

    fetch(`/get_initial_data?department=${encodeURIComponent(dept)}`)
    .then(res => res.json())
    .then(data => {

        updateKPIs(data.summary);
        drawHistogram(data.distribution);
        showInfluencers(data.influencers);

    });
}

function runDepartmentSimulation() {

    const dept = document.getElementById("departmentSelect").value;

    const manualRules = [];

    document.querySelectorAll(".rule").forEach(rule => {
        manualRules.push({
            variable: rule.querySelector(".variable").value,
            change: rule.querySelector(".change").value,
            condition: rule.querySelector(".condition").value
        });
    });

    const nlpRules = window.currentNLPRules || [];

    const rules = [...manualRules, ...nlpRules];

    document.querySelectorAll(".rule").forEach(rule => {
        rules.push({
            variable: rule.querySelector(".variable").value,
            change: rule.querySelector(".change").value,
            condition: rule.querySelector(".condition").value
        });
    });

    fetch("/simulate_company", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            rules: rules,
            department: dept
        })
    })
    .then(res => res.json())
    .then(res => {

        document.getElementById("baselineAvg").innerText = res.baseline_mean;
        document.getElementById("scenarioAvg").innerText = res.scenario_mean;
        document.getElementById("impact").innerText = res.impact;

        drawComparisonHistogram(
            res.baseline_distribution,
            res.scenario_distribution
        );
    });
}

function loadDepartments() {

    fetch("/get_departments")
    .then(res => res.json())
    .then(departments => {

        const dropdown = document.getElementById("departmentSelect");

        // Clear existing (safety)
        dropdown.innerHTML = '<option value="">-- Select Department --</option>';

        departments.forEach(dept => {

            const option = document.createElement("option");
            option.value = dept;
            option.textContent = dept;

            dropdown.appendChild(option);
        });
    });
}

function loadJobRoles() {

    fetch("/get_job_roles")
    .then(res => res.json())
    .then(roles => {

        const dropdown = document.getElementById("jobRoleSelect");

        dropdown.innerHTML = '<option value="">-- Select Job Role --</option>';

        roles.forEach(role => {
            const option = document.createElement("option");
            option.value = role;
            option.textContent = role;
            dropdown.appendChild(option);
        });
    });
}

function loadVariables() {
    fetch("/get_variables")
    .then(res => res.json())
    .then(cols => {
        allVariables = cols;
    });
}

function loadJobRolePage() {

    const role = document.getElementById("jobRoleSelect").value;

    if (!role) return;

    document.getElementById("dashboardContent").style.display = "block";

    fetch(`/get_initial_data?job_role=${encodeURIComponent(role)}`)
    .then(res => res.json())
    .then(data => {
        updateKPIs(data.summary);
        drawHistogram(data.distribution);
        showInfluencers(data.influencers);
    });
}

function searchEmployee() {

    const empId = document.getElementById("empSearch").value;

    fetch(`/get_employee?emp_id=${empId}`)
    .then(res => res.json())
    .then(emp => {

        document.getElementById("individualContent").style.display = "block";

        // ✅ PROFILE DATA (keep as is)
        document.getElementById("empId").innerText = emp.EmpID;
        document.getElementById("empName").innerText = emp.Name;
        document.getElementById("empAge").innerText = emp.Age;
        document.getElementById("empDept").innerText = emp.EmpDepartment;
        document.getElementById("empRole").innerText = emp.EmpJobRole;
        document.getElementById("empScore").innerText = emp.PerformanceScore;

        // ✅ IMAGE (keep as is)
        const img = document.getElementById("empImage");

        if (emp.Gender.toLowerCase() === "male") {
            img.src = "/static/images/male.jpg";
        } else {
            img.src = "/static/images/female.jpg";
        }

        // ✅ NEW: EXTRA DETAILS SECTION

        const exclude = [
            "EmpNumber",
            "EmpID",
            "Name",
            "Age",
            "Gender",
            "EmpDepartment",
            "Department",
            "EmpJobRole",
            "JobRole",
            "PerformanceScore"
        ];

        const container = document.getElementById("extraDetails");
        container.innerHTML = "";

        Object.keys(emp).forEach(key => {

            if (exclude.includes(key)) return;

            const div = document.createElement("div");
            div.classList.add("detail-item");

            div.innerHTML = `
                <span>${formatVariableName(key)}</span>
                <strong>${emp[key]}</strong>
            `;

            container.appendChild(div);
        });

    });
}

function addIndividualRule() {

    const container = document.getElementById("rules-container");

    const excludedVars = [
        "EmpNumber",
        "Age",
        "Gender",
        "EducationBackground",
        "MaritalStatus",
        "EmpDepartment",
        "EmpJobRole",
        "EmpEducationLevel",
        "NumCompaniesWorked",
        "TotalWorkExperienceInYears",
        "PerformanceScore"
    ];

    const div = document.createElement("div");
    div.classList.add("rule");

    // ✅ ONLY HTML HERE
    div.innerHTML = `
        <select class="variable"></select>

        <input type="number" class="change" placeholder="+/-" />

        <select class="catValue" style="display:none;">
            <option value="Manager">Manager</option>
            <option value="Developer">Developer</option>
        </select>

        <button class="delete-btn">✖</button>
    `;

    // ✅ DELETE BUTTON
    div.querySelector(".delete-btn").addEventListener("click", () => {
        div.remove();
    });

    // ✅ GET ELEMENTS AFTER HTML IS CREATED
    const variableSelect = div.querySelector(".variable");
    const change = div.querySelector(".change");
    const cat = div.querySelector(".catValue");

    // ✅ FILTER VARIABLES (uses global allVariables)
    const allowed = allVariables.filter(v => !excludedVars.includes(v));

    // ✅ POPULATE DROPDOWN
    const numericVars = [
        "ExperienceYearsInCurrentRole",
        "TotalWorkExperienceInYears",
        "EmpLastSalaryHikePercent",
        "EmpEnvironmentSatisfaction",
        "ExperienceYearsAtThisCompany",
        "TrainingTimesLastYear",
        "EmpHourlyRate",
        "Age",
        "DistanceFromHome",
        "EmpJobInvolvement",
        "EmpJobLevel",
        "EmpJobSatisfaction",
        "EmpWorkLifeBalance",
        "EmpRelationshipSatisfaction",
        "YearsSinceLastPromotion",
        "YearsWithCurrManager"
    ];

    allowed.forEach(v => {
        const option = document.createElement("option");
        option.value = v;
        option.textContent = formatVariableName(v);

        // ✅ ADD THIS
        if (numericVars.includes(v)) {
            option.dataset.type = "numeric";
        } else {
            option.dataset.type = "categorical";
        }

        variableSelect.appendChild(option);
    });

    // ✅ TOGGLE INPUT TYPE
    variableSelect.addEventListener("change", () => {

        const selectedVar = variableSelect.value;
        const type = variableSelect.selectedOptions[0].dataset.type;

        if (type === "numeric") {
            change.style.display = "inline";
            cat.style.display = "none";
        } else {
            change.style.display = "none";
            cat.style.display = "inline";

            // ✅ Fetch categories dynamically
            fetch(`/get_categories?column=${selectedVar}`)
            .then(res => res.json())
            .then(values => {

                cat.innerHTML = "";

                values.forEach(val => {
                    const option = document.createElement("option");
                    option.value = val;
                    option.textContent = formatVariableName(val);
                    cat.appendChild(option);
                });

            });
        }
    });

    container.appendChild(div);
}

function runIndividualSimulation() {

    const empId = document.getElementById("empId").innerText;

    const rules = [];

    document.querySelectorAll(".rule").forEach(rule => {

        const variable = rule.querySelector(".variable");
        const type = variable.selectedOptions[0].dataset.type;

        if (type === "numeric") {
            rules.push({
                variable: variable.value,
                type: "numeric",
                change: rule.querySelector(".change").value
            });
        } else {
            rules.push({
                variable: variable.value,
                type: "categorical",
                value: rule.querySelector(".catValue").value
            });
        }
    });

    fetch("/simulate_individual", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            emp_id: empId,
            rules: rules
        })
    })
    .then(res => res.json())
    .then(res => {

        document.getElementById("baseline").innerText = res.baseline;
        document.getElementById("scenario").innerText = res.scenario;
        const impactEl = document.getElementById("impact");

        const impactValue = parseFloat(res.impact);

        if (impactValue > 0) {
            impactEl.innerText = "+" + res.impact + " ↑";
            impactEl.style.color = "#22c55e";
        } else if (impactValue < 0) {
            impactEl.innerText = res.impact + " ↓";
            impactEl.style.color = "#ef4444";
        } else {
            impactEl.innerText = res.impact;
            impactEl.style.color = "white";
        }

    });
}

function getPrediction() {

    const data = {
        Age: +document.getElementById("Age").value,
        Gender: document.getElementById("Gender").value,
        EducationBackground: document.getElementById("EducationBackground").value,
        MaritalStatus: document.getElementById("MaritalStatus").value,
        EmpDepartment: document.getElementById("EmpDepartment").value,
        EmpJobRole: document.getElementById("EmpJobRole").value,
        BusinessTravelFrequency: document.getElementById("BusinessTravelFrequency").value,
        DistanceFromHome: +document.getElementById("DistanceFromHome").value,
        EmpEducationLevel: +document.getElementById("EmpEducationLevel").value,
        EmpEnvironmentSatisfaction: +document.getElementById("EmpEnvironmentSatisfaction").value,
        EmpHourlyRate: +document.getElementById("EmpHourlyRate").value,
        EmpJobInvolvement: +document.getElementById("EmpJobInvolvement").value,
        EmpJobLevel: +document.getElementById("EmpJobLevel").value,
        EmpJobSatisfaction: +document.getElementById("EmpJobSatisfaction").value,
        NumCompaniesWorked: +document.getElementById("NumCompaniesWorked").value,
        OverTime: document.getElementById("OverTime").value,
        EmpLastSalaryHikePercent: +document.getElementById("EmpLastSalaryHikePercent").value,
        EmpRelationshipSatisfaction: +document.getElementById("EmpRelationshipSatisfaction").value,
        TotalWorkExperienceInYears: +document.getElementById("TotalWorkExperienceInYears").value,
        TrainingTimesLastYear: +document.getElementById("TrainingTimesLastYear").value,
        EmpWorkLifeBalance: +document.getElementById("EmpWorkLifeBalance").value,
        ExperienceYearsAtThisCompany: +document.getElementById("ExperienceYearsAtThisCompany").value,
        ExperienceYearsInCurrentRole: +document.getElementById("ExperienceYearsInCurrentRole").value,
        YearsSinceLastPromotion: +document.getElementById("YearsSinceLastPromotion").value,
        YearsWithCurrManager: +document.getElementById("YearsWithCurrManager").value
    };

    fetch("/predict", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(res => {
        document.getElementById("predictionResult").innerText =
            "Predicted Score: " + res.prediction;
    });
}

function loadDepartmentsForPrediction() {
    fetch("/get_departments")
    .then(res => res.json())
    .then(depts => {
        const dropdown = document.getElementById("EmpDepartment");
        depts.forEach(d => {
            const opt = document.createElement("option");
            opt.value = d;
            opt.textContent = d;
            dropdown.appendChild(opt);
        });
    });
}

function loadJobRolesForPrediction() {
    fetch("/get_job_roles")
    .then(res => res.json())
    .then(roles => {
        const dropdown = document.getElementById("EmpJobRole");
        roles.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = r;
            dropdown.appendChild(opt);
        });
    });
}

function resetPrediction() {

    // Reset all inputs
    document.querySelectorAll(".form-grid input").forEach(input => {
        input.value = "";
    });

    // Reset all dropdowns
    document.querySelectorAll(".form-grid select").forEach(select => {
        select.selectedIndex = 0;
    });

    // Reset prediction result
    const result = document.getElementById("predictionResult");
    result.innerText = "-";
    result.style.color = "white";
}

function processNLP() {

    const text = document.getElementById("nlpInput").value;

    if (!text) {
        alert("Please enter a scenario");
        return;
    }

    fetch("/nlp_parse", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: text })
    })
    .then(res => res.json())
    .then(res => {

        console.log("Parsed NLP Rules:", res.rules);

        // ❌ REMOVE THIS (IMPORTANT)
        // document.getElementById("rules-container").innerHTML = "";
        // res.rules.forEach(rule => addRuleFromNLP(rule));

        // ✅ STORE NLP RULES GLOBALLY
        window.currentNLPRules = res.rules;

        // ✅ OPTIONAL: show summary instead of rules UI
        showNLPSummary(res.rules);

    });
}

function showNLPSummary(rules) {

    const container = document.getElementById("nlpSummary");
    container.innerHTML = "";

    rules.forEach(rule => {

        const conditionVar = rule.condition_variable || rule.target_variable;

        // ✅ NEW: handle categorical + numeric
        const conditionText = rule.condition_value
            ? `= ${rule.condition_value}`
            : (rule.condition || "ALL");

        container.innerHTML += `
            <div style="padding:10px; margin-bottom:8px; background:#1e293b; border-radius:8px;">
                <b>AI Scenario</b><br>
                Change <b>${formatFeatureName(rule.target_variable)}</b> by ${rule.change}<br>
                Where <b>${formatFeatureName(conditionVar)}</b> ${conditionText}
            </div>
        `;
    });
}

function addRuleFromNLP(rule) {

    const container = document.getElementById("rules-container");

    const div = document.createElement("div");
    div.classList.add("rule");

    div.innerHTML = `
        <select class="variable">
            <option value="${rule.variable}" selected>${rule.variable}</option>
        </select>

        <input type="number" class="change" value="${rule.change}" />

        <input type="text" class="condition" value="${rule.condition || ''}" />

        <button class="delete-btn">✖</button>
    `;

    div.querySelector(".delete-btn").addEventListener("click", () => {
        div.remove();
    });

    container.appendChild(div);
}