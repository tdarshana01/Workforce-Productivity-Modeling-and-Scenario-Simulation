# AI-Driven Workforce Productivity Modeling and Scenario Simulation Using HRIS Data

## Overview

This project presents an end-to-end workforce analytics framework that combines statistical analysis, machine learning, explainable AI, and scenario simulation to support data-driven workforce management.

The framework predicts employee performance using Human Resource Information System (HRIS) data and enables HR practitioners to evaluate hypothetical workforce strategies through an interactive simulation platform before implementation. The system provides transparent model explanations using SHAP and supports natural language-based scenario generation to make advanced analytics accessible to non-technical users.

---

## Features

- Employee performance prediction using machine learning
- Comprehensive exploratory data analysis (EDA)
- Statistical hypothesis testing and correlation analysis
- Workforce segmentation using FAMD and K-Means clustering
- Explainable AI using SHAP
- Company, department, job role, and individual-level scenario simulation
- Natural language interface for defining simulation scenarios
- Interactive web application built with Flask

---

## Methodology

The project follows a complete data science workflow:

1. Data preprocessing
   - Data cleaning
   - One-hot encoding
   - Outlier detection using the IQR method

2. Exploratory Data Analysis
   - Univariate and bivariate analysis
   - Pearson correlation analysis
   - Chi-square tests for categorical variables

3. Workforce Segmentation
   - Factor Analysis of Mixed Data (FAMD)
   - K-Means clustering

4. Predictive Modeling
   - Linear Regression
   - Support Vector Regressor (SVR)
   - Decision Tree Regressor
   - Random Forest Regressor
   - Gradient Boosting Regressor
   - AdaBoost Regressor
   - K-Nearest Neighbors Regressor
   - XGBoost Regressor

5. Model Evaluation
   - R²
   - RMSE
   - MAE
   - Cross-validation

6. Explainable AI
   - SHAP feature importance
   - Global model interpretation

7. Scenario Simulation
   - Manual rule-based simulations
   - Natural language-driven scenario generation
   - Performance impact comparison

---

## Results

The final XGBoost model achieved:

| Metric | Value |
|---------|--------|
| R² | **0.94** |
| RMSE | **0.96** |

The model demonstrated strong predictive performance while maintaining interpretability through SHAP-based explanations.

---

## Simulation Tool

The simulation platform enables HR practitioners to evaluate hypothetical workforce interventions before implementation.

Simulation is available at four organizational levels:

- Company
- Department
- Job Role
- Individual Employee

Users can:

- Modify workforce variables manually
- Apply conditional rules
- Generate scenarios using natural language
- Compare baseline and simulated performance distributions
- Measure overall organizational impact

Example:

> Increase training by 5 for employees with less than 5 years of experience.

The NLP interface automatically converts the instruction into executable simulation rules and updates performance predictions accordingly.

---

## Technologies Used

### Programming

- Python

### Machine Learning

- Scikit-learn
- XGBoost

### Data Analysis

- Pandas
- NumPy

### Explainable AI

- SHAP

### Web Framework

- Flask

### Frontend

- HTML
- CSS
- JavaScript

### Visualization

- Plotly.js

---

## Project Structure

```
project/
│
├── app.py
├── model/
│   ├── xgb_model.pkl
│   └── pipeline.joblib
│
├── data/
│   └── dataset.csv
│
├── templates/
│
├── static/
│
└── README.md
```

---

## Future Improvements

- Integration with live HRIS databases
- Advanced NLP using Large Language Models (LLMs)
- Automated workforce optimization recommendations
- Time-series workforce forecasting
- Cloud deployment

---

## Research Contribution

This project extends traditional employee performance prediction by integrating predictive analytics with an interactive decision-support framework. Rather than providing static predictions, the developed system enables organizations to evaluate the impact of hypothetical workforce strategies before implementation, supporting proactive and evidence-based decision-making.

---

## Author

**Tharindu Panditawatta**

BSc (Hons) in Applied Statistics

University of Colombo

---
