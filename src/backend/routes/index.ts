import express from "express";
import serviceRoutes from "./mcpServiceConfig/mcpServiceConfig.ts";
import llmRoutes from "./llmChat/llmChat.ts";
import serverConfigRoutes from "./serverConfiguration/serverConfiguration.ts";
import helperActionRoutes from "./helperAction/helperAction.ts";

const router = express.Router();

router.use("/services", serviceRoutes);
router.use("/chat", llmRoutes);
router.use("/server-config", serverConfigRoutes);
router.use("/helper-action", helperActionRoutes);

export default router;
