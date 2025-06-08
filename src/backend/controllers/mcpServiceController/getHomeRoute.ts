
import { Request, Response } from "express";
import { app } from "electron";


export const getHomePath = (_req: Request, res: Response) => {
  try {
    return res.json({path:app.getPath('home')});
  } catch (error: unknown) {
    const err = error as Error;
    console.log(err);
    res.status(500).json({ error: "Failed to read config.", message: err.message });
  }
};
