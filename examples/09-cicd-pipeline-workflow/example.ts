import { CommonDataType, Commutator } from "@commutator/core";

// CI/CD Pipeline Workflow
const commutator = Commutator.initialize()
  .defineDataType("BuildInfo", {
    type: CommonDataType.Object,
    properties: {
      commitHash: { type: CommonDataType.String },
      branch: { type: CommonDataType.String },
      buildId: { type: CommonDataType.String },
    },
  })
  .defineEvent("CodePushed", {
    pinsOut: {
      commitHash: { type: CommonDataType.String },
      branch: { type: CommonDataType.String },
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("BuildProject", {
    pinsIn: {
      commitHash: { type: CommonDataType.String },
      branch: { type: CommonDataType.String },
    },
    pinsOut: {
      buildId: { type: CommonDataType.String },
      buildSuccess: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { success: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция сборки
      const buildSuccess = Math.random() > 0.1; // 90% успешных сборок
      const buildId = `build_${Date.now()}`;

      if (buildSuccess) {
        await exec({
          execPinOut: "success",
          pinsOut: {
            buildId,
            buildSuccess: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            buildId: "",
            buildSuccess: false,
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("RunTests", {
    pinsIn: {
      buildId: { type: CommonDataType.String },
    },
    pinsOut: {
      testsPassed: { type: CommonDataType.Boolean },
      testCoverage: { type: CommonDataType.Number },
    },
    execPinsIn: { start: {} },
    execPinsOut: { passed: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция тестов
      const testsPassed = Math.random() > 0.15; // 85% прохождения тестов
      const testCoverage = Math.random() * 100;

      if (testsPassed && testCoverage > 70) {
        await exec({
          execPinOut: "passed",
          pinsOut: {
            testsPassed: true,
            testCoverage,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            testsPassed: false,
            testCoverage,
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("LintCode", {
    pinsIn: {
      buildId: { type: CommonDataType.String },
    },
    pinsOut: {
      lintPassed: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { passed: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция линтинга
      const lintPassed = Math.random() > 0.2; // 80% прохождения линтинга

      if (lintPassed) {
        await exec({
          execPinOut: "passed",
          pinsOut: {
            lintPassed: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            lintPassed: false,
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("DeployToStaging", {
    pinsIn: {
      buildId: { type: CommonDataType.String },
    },
    pinsOut: {
      stagingUrl: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { success: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция деплоя на staging
      const success = Math.random() > 0.1;
      const stagingUrl = success ? `https://staging-${pinsIn.buildId}.example.com` : "";

      if (success) {
        await exec({
          execPinOut: "success",
          pinsOut: {
            stagingUrl,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            stagingUrl: "",
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("RunIntegrationTests", {
    pinsIn: {
      stagingUrl: { type: CommonDataType.String },
    },
    pinsOut: {
      integrationTestsPassed: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { passed: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция интеграционных тестов
      const passed = Math.random() > 0.2;

      if (passed) {
        await exec({
          execPinOut: "passed",
          pinsOut: {
            integrationTestsPassed: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            integrationTestsPassed: false,
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("DeployToProduction", {
    pinsIn: {
      buildId: { type: CommonDataType.String },
      stagingUrl: { type: CommonDataType.String },
    },
    pinsOut: {
      productionUrl: { type: CommonDataType.String },
    },
    execPinsIn: { start: {} },
    execPinsOut: { success: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция деплоя в production
      const success = Math.random() > 0.15;
      const productionUrl = success ? `https://prod-${pinsIn.buildId}.example.com` : "";

      if (success) {
        await exec({
          execPinOut: "success",
          pinsOut: {
            productionUrl,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            productionUrl: "",
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("RollbackDeployment", {
    pinsIn: {
      buildId: { type: CommonDataType.String },
      environment: { type: CommonDataType.String },
    },
    pinsOut: {
      rolledBack: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(`[RollbackDeployment] Rolling back ${pinsIn.buildId} from ${pinsIn.environment}`);
      await exec({
        execPinOut: "next",
        pinsOut: {
          rolledBack: true,
        },
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const codePushed = schema.createEvent("CodePushed");
const buildProject = schema.createFunction("BuildProject");
const runTests = schema.createFunction("RunTests");
const lintCode = schema.createFunction("LintCode");
const deployToStaging = schema.createFunction("DeployToStaging");
const runIntegrationTests = schema.createFunction("RunIntegrationTests");
const deployToProduction = schema.createFunction("DeployToProduction");
const rollbackDeployment = schema.createFunction("RollbackDeployment");

// Подключаем CI/CD pipeline
schema.wire(codePushed, "commitHash", buildProject, "commitHash");
schema.wire(codePushed, "branch", buildProject, "branch");
schema.wire(codePushed, "next", buildProject, "start");

// Параллельные задачи после успешной сборки
schema.wire(buildProject, "buildId", runTests, "buildId");
schema.wire(buildProject, "buildId", lintCode, "buildId");
schema.wire(buildProject, "success", runTests, "start");
schema.wire(buildProject, "success", lintCode, "start");

// Деплой на staging только если тесты и линтинг прошли
schema.wire(runTests, "passed", deployToStaging, "start");
schema.wire(lintCode, "passed", deployToStaging, "start");
schema.wire(buildProject, "buildId", deployToStaging, "buildId");

// Интеграционные тесты на staging
schema.wire(deployToStaging, "stagingUrl", runIntegrationTests, "stagingUrl");
schema.wire(deployToStaging, "success", runIntegrationTests, "start");

// Деплой в production после успешных интеграционных тестов
schema.wire(runIntegrationTests, "passed", deployToProduction, "start");
schema.wire(buildProject, "buildId", deployToProduction, "buildId");
schema.wire(deployToStaging, "stagingUrl", deployToProduction, "stagingUrl");

// Откат при ошибках
schema.wire(buildProject, "failed", rollbackDeployment, "start");
schema.wire(runTests, "failed", rollbackDeployment, "start");
schema.wire(lintCode, "failed", rollbackDeployment, "start");
schema.wire(deployToStaging, "failed", rollbackDeployment, "start");
schema.wire(runIntegrationTests, "failed", rollbackDeployment, "start");
schema.wire(deployToProduction, "failed", rollbackDeployment, "start");
schema.wire(buildProject, "buildId", rollbackDeployment, "buildId");

console.log("CI/CD Pipeline Workflow created!");
