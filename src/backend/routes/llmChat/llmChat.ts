import { Router } from "express";
import { chatWithLLM } from "../../controllers/llmChat/chatLLM";
import { audioToTextHandler } from "../../controllers/llmChat/audioToText";

const router = Router();

router.post("/", chatWithLLM);
router.post("/text", audioToTextHandler);

export default router;
