import express from "express";
import { getOrganization, updateOrganization } from "../controllers/organization.controller.js";

export const organizationRoutes = express.Router();

organizationRoutes.get("/", getOrganization);
organizationRoutes.put("/", updateOrganization);

export default organizationRoutes;
