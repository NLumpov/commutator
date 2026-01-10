import { CommonDataType, Commutator } from "@commutator/core";

// Система авторизации и прав доступа
const commutator = Commutator.initialize()
  .defineDataType("User", {
    type: CommonDataType.Object,
    properties: {
      id: { type: CommonDataType.String },
      roles: { type: CommonDataType.Array, itemType: { type: CommonDataType.String } },
    },
  })
  .defineDataType("AccessRequest", {
    type: CommonDataType.Object,
    properties: {
      userId: { type: CommonDataType.String },
      resourceId: { type: CommonDataType.String },
      action: { type: CommonDataType.String },
    },
  })
  .defineEvent("AccessRequest", {
    pinsOut: {
      request: { type: CommonDataType.String }, // JSON AccessRequest
      token: { type: CommonDataType.String },
    },
    execPinsOut: { next: {} },
  })
  .defineFunction("AuthenticateUser", {
    pinsIn: {
      token: { type: CommonDataType.String },
    },
    pinsOut: {
      userId: { type: CommonDataType.String },
      authenticated: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { success: {}, failed: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция аутентификации
      const authenticated = pinsIn.token !== "" && pinsIn.token !== "invalid";
      const userId = authenticated ? `user_${pinsIn.token}` : "";

      if (authenticated) {
        await exec({
          execPinOut: "success",
          pinsOut: {
            userId,
            authenticated: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "failed",
          pinsOut: {
            userId: "",
            authenticated: false,
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("LoadUserRoles", {
    pinsIn: {
      userId: { type: CommonDataType.String },
    },
    pinsOut: {
      roles: { type: CommonDataType.String }, // JSON array
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция загрузки ролей
      const roles = pinsIn.userId?.startsWith("admin") ? ["admin", "user"] : ["user"];

      await exec({
        execPinOut: "next",
        pinsOut: {
          roles: JSON.stringify(roles),
        },
        meta: null,
      });
    },
  })
  .definePureFunction("CheckPermission", {
    pinsIn: {
      roles: { type: CommonDataType.String }, // JSON array
      action: { type: CommonDataType.String },
      resourceType: { type: CommonDataType.String },
    },
    pinsOut: {
      hasPermission: { type: CommonDataType.Boolean },
    },
    exec: async ({ pinsIn }) => {
      const roles = JSON.parse(pinsIn.roles ?? "[]");
      const action = pinsIn.action ?? "";
      const resourceType = pinsIn.resourceType ?? "";

      // Правила доступа
      const hasPermission =
        roles.includes("admin") ||
        (roles.includes("user") && action === "read") ||
        (roles.includes("editor") && ["read", "write"].includes(action));

      return { hasPermission };
    },
  })
  .definePureFunction("EvaluateContextRules", {
    pinsIn: {
      request: { type: CommonDataType.String },
      userRoles: { type: CommonDataType.String },
    },
    pinsOut: {
      allowed: { type: CommonDataType.Boolean },
      reason: { type: CommonDataType.String },
    },
    exec: async ({ pinsIn }) => {
      const request = JSON.parse(pinsIn.request ?? "{}");
      const roles = JSON.parse(pinsIn.userRoles ?? "[]");

      // Контекстные правила (например, время суток, IP и т.д.)
      const allowed = roles.includes("admin") || request.action === "read";
      const reason = allowed ? "Allowed by context rules" : "Blocked by context rules";

      return { allowed, reason };
    },
  })
  .defineFunction("CheckResourceOwnership", {
    pinsIn: {
      userId: { type: CommonDataType.String },
      resourceId: { type: CommonDataType.String },
    },
    pinsOut: {
      isOwner: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { owner: {}, notOwner: {} },
    exec: async ({ pinsIn, exec }) => {
      // Симуляция проверки владения
      const isOwner =
        pinsIn.resourceId?.includes(pinsIn.userId ?? "") || pinsIn.userId?.startsWith("admin");

      if (isOwner) {
        await exec({
          execPinOut: "owner",
          pinsOut: {
            isOwner: true,
          },
          meta: null,
        });
      } else {
        await exec({
          execPinOut: "notOwner",
          pinsOut: {
            isOwner: false,
          },
          meta: null,
        });
      }
    },
  })
  .defineFunction("GrantAccess", {
    pinsIn: {
      request: { type: CommonDataType.String },
    },
    pinsOut: {
      accessGranted: { type: CommonDataType.Boolean },
    },
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(`[GrantAccess] Access granted for request: ${pinsIn.request}`);
      await exec({
        execPinOut: "next",
        pinsOut: {
          accessGranted: true,
        },
        meta: null,
      });
    },
  })
  .defineFunction("LogAccess", {
    pinsIn: {
      request: { type: CommonDataType.String },
      granted: { type: CommonDataType.Boolean },
    },
    pinsOut: {},
    execPinsIn: { start: {} },
    execPinsOut: { next: {} },
    exec: async ({ pinsIn, exec }) => {
      console.log(`[LogAccess] Request: ${pinsIn.request}, Granted: ${pinsIn.granted}`);
      await exec({
        execPinOut: "next",
        pinsOut: {},
        meta: null,
      });
    },
  });

const schema = commutator.createSchema();

// Создаем ноды
const accessRequest = schema.createEvent("AccessRequest");
const authenticateUser = schema.createFunction("AuthenticateUser");
const loadUserRoles = schema.createFunction("LoadUserRoles");
const checkPermission = schema.createPureFunction("CheckPermission");
const evaluateContextRules = schema.createPureFunction("EvaluateContextRules");
const checkResourceOwnership = schema.createFunction("CheckResourceOwnership");
const grantAccess = schema.createFunction("GrantAccess");
const logAccess = schema.createFunction("LogAccess");

// Подключаем схему авторизации
schema.wire(accessRequest, "token", authenticateUser, "token");
schema.wire(accessRequest, "next", authenticateUser, "start");

schema.wire(authenticateUser, "userId", loadUserRoles, "userId");
schema.wire(authenticateUser, "success", loadUserRoles, "start");

schema.wire(loadUserRoles, "roles", checkPermission, "roles");
schema.wire(accessRequest, "request", checkPermission, "action"); // Нужно извлечь action
schema.wire(loadUserRoles, "roles", evaluateContextRules, "userRoles");
schema.wire(accessRequest, "request", evaluateContextRules, "request");

schema.wire(authenticateUser, "userId", checkResourceOwnership, "userId");
schema.wire(accessRequest, "request", checkResourceOwnership, "resourceId"); // Нужно извлечь resourceId
schema.wire(authenticateUser, "success", checkResourceOwnership, "start");

schema.wire(checkResourceOwnership, "owner", grantAccess, "start");
schema.wire(checkPermission, "hasPermission", grantAccess, "start");
schema.wire(evaluateContextRules, "allowed", grantAccess, "start");
schema.wire(accessRequest, "request", grantAccess, "request");

schema.wire(grantAccess, "accessGranted", logAccess, "granted");
schema.wire(accessRequest, "request", logAccess, "request");
schema.wire(grantAccess, "next", logAccess, "start");

console.log("Authorization & Permissions System created!");
