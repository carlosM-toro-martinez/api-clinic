import { z } from 'zod';
import type { Patient, Prisma } from '../../node_modules/.prisma/tenant-client';

export const createPatientSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  ciNumber: z.string().optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  gender: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  insuranceInfo: z.any().optional().nullable(),
}).strict();

export const updatePatientSchema = createPatientSchema.partial();

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export type PatientResponse = Patient & {
  medicalHistories: any[];
  appointments: any[];
  prescriptions: any[];
};

export type PaginatedPatients = {
  items: PatientResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
};

export type ListPatientsQuery = {
  page?: number;
  limit?: number;
};