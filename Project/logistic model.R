df = read.csv("D:/UOC/4th year/2nd semester/Research Project/research dataset/employee_data.csv", stringsAsFactors=TRUE)
str(df)
attach(df)
df$EmpNumber <- NULL
df$Attrition <- NULL

#--------------linear regression-----------------------
set.seed(123)
train_index <- sample(1:nrow(df),0.8*nrow(df))
train_data <- df[train_index,]
test_data <- df[-train_index,]

null_model <- lm(PerformanceScore ~ 1.,data = train_data)
full_model <- lm(PerformanceScore ~.-EmpJobRole,data = train_data)

forward_model <- step(null_model,
                      scope = formula(full_model),
                      direction = 'forward')

summary(forward_model)
y_pred <- predict(forward_model,newdata = test_data)
library(caret)
R2(y_pred,test_data$PerformanceScore)
RMSE(y_pred,test_data$PerformanceScore)

plot(forward_model)

library(car)
vif(forward_model)

#--------------------statistical tests----------------------------

t.test(PerformanceScore~Gender,data = df)

anova_travel <- aov(PerformanceScore~BusinessTravelFrequency,data = df)
summary(anova_travel)
shapiro.test(residuals(anova_travel))
qqnorm(residuals(anova_travel))
qqline(residuals(anova_travel))
library(car)
leveneTest(PerformanceScore~BusinessTravelFrequency,data = df)
kruskal.test(PerformanceScore~BusinessTravelFrequency,data = df)

t.test(PerformanceScore~OverTime,data = df)
hist(df$PerformanceScore[df$OverTime == "Yes"])
hist(df$PerformanceScore[df$OverTime == "No"])

df$EmpWorkLifeBalance <- as.factor(df$EmpWorkLifeBalance)
anova_env <- aov(PerformanceScore~EmpWorkLifeBalance,data=df)
summary(anova_env)
leveneTest(PerformanceScore~EmpWorkLifeBalance,data=df)

cor.test(PerformanceScore,Age)
cor.test(PerformanceScore,ExperienceYearsAtThisCompany)
cor.test(PerformanceScore,ExperienceYearsInCurrentRole)
cor.test(PerformanceScore,DistanceFromHome)
cor.test(PerformanceScore,TotalWorkExperienceInYears)
cor.test(PerformanceScore,EmpJobSatisfaction,method = 'spearman')
cor.test(PerformanceScore,EmpEnvironmentSatisfaction,method = 'spearman')
cor.test(PerformanceScore,EmpJobLevel,method = 'spearman')
cor.test(PerformanceScore,EmpWorkLifeBalance,method = 'spearman')
cor.test(PerformanceScore,EmpEducationLevel,method = 'spearman')

#-----------FAMD---------------------

library(FactoMineR)
library(factoextra)

df_famd <- df
df_famd$Attrition <- NULL
df_famd$PerformanceScore <- NULL

res.famd <- FAMD(df_famd,ncp = 25,graph = F)
res.famd$eig
fviz_screeplot(res.famd, addlabels = TRUE)
