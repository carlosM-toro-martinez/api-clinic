
import type { PrismaClient as TenantPrisma } from '../../node_modules/.prisma/tenant-client';
import { AppError } from '../utils/app.error';

interface MedicalHistoryInput {
  patientId: string;
  specialtyId: string;
  createdById: string;
  note?: string;
}

interface HistoryEntryInput {
  doctorId: string;
  visitDate?: string | Date | null;
  chiefComplaint?: string;
  subjectiveNote?: string;
  objectiveNote?: string;
  assessment?: string;
  plan?: string;
  vitals?: any;
  // Campos extendidos (coinciden con el schema Prisma)
  pathologicalHistory?: string | null;
  surgicalHistory?: string | null;
  habitualMedication?: string | null;
  menarcheAge?: string | null;
  lastMenstrualPeriod?: string | Date | null;
  obstetricHistory?: string | null;
  diet?: string | null;
  physicalActivity?: string | null;
  smokes?: boolean | null;
  alcohol?: boolean | null;
  drugs?: boolean | null;
  drugsDetails?: string | null;
  labResults?: string | null;
  imagingResults?: string | null;
  otherStudies?: string | null;
  nonPharmacologicalTreatment?: string | null;
  requestedStudies?: string | null;
  referrals?: string | null;
  followUp?: string | null;
}

interface DiagnosisInput {
  diagnosisId: string;
  isPrimary?: boolean;
}

interface PrescriptionInput {
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface CreateMedicalHistoryData {
  medicalHistoryData: MedicalHistoryInput;
  historyEntryData: HistoryEntryInput;
  diagnoses?: DiagnosisInput[];
  prescriptions?: PrescriptionInput[];
  appointmentId?: string;
  appointmentNotes?: string;
}

interface CreateMedicalHistoryResult {
  id: string;
  visitDate: Date;
  chiefComplaint?: string;
  subjectiveNote?: string;
  objectiveNote?: string;
  assessment?: string;
  plan?: string;
  vitals?: any;
  history: {
    id: string;
    note?: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      ciNumber?: string;
    };
    specialty: {
      id: string;
      name: string;
    };
  };
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
  };
  diagnoses?: Array<{
    id: string;
    isPrimary: boolean;
    diagnosis: {
      id: string;
      code?: string;
      name: string;
    };
  }>;
  prescriptions?: Array<{
    id: string;
    prescriptionDate: Date;
    instructions: string;
    notes?: string;
    medications: Array<{
      id: string;
      medicationName: string;
      dosage: string;
      frequency: string;
      duration: string;
      notes?: string;
    }>;
  }>;
}

// Corrige los tipos para que coincidan con las consultas
type PatientMedicalHistoryResult = {
  id: string;
  patientId: string;
  specialtyId: string;
  createdById: string;
  createdAt: Date;
  note: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    ciNumber: string | null;
    birthDate: Date | null;
    gender: string | null;
    phone: string | null;
    email: string | null;
  };
  specialty: {
    id: string;
    name: string;
    description: string | null;
  };
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  entries: HistoryEntryResult[];
};

type HistoryEntryResult = {
  id: string;
  historyId: string;
  doctorId: string;
  visitDate: Date;
  chiefComplaint: string | null;
  subjectiveNote: string | null;
  objectiveNote: string | null;
  assessment: string | null;
  plan: string | null;
  vitals: any;
  pathologicalHistory: string | null;
  surgicalHistory: string | null;
  habitualMedication: string | null;
  menarcheAge: string | null;
  lastMenstrualPeriod: Date | null;
  obstetricHistory: string | null;
  diet: string | null;
  physicalActivity: string | null;
  smokes: boolean;
  alcohol: boolean;
  drugs: boolean;
  drugsDetails: string | null;
  labResults: string | null;
  imagingResults: string | null;
  otherStudies: string | null;
  nonPharmacologicalTreatment: string | null;
  requestedStudies: string | null;
  referrals: string | null;
  followUp: string | null;
  createdAt: Date;
  history: {
    id: string;
    patientId: string;
    specialtyId: string;
    createdAt: Date;
    note: string | null;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      ciNumber: string | null;
    };
    specialty: {
      id: string;
      name: string;
    };
  };
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    // email es opcional ya que no siempre lo estamos seleccionando
    email?: string;
  };
  diagnoses: {
    id: string;
    historyEntryId: string;
    diagnosisId: string;
    isPrimary: boolean;
    diagnosis: {
      id: string;
      code: string | null;
      name: string;
      description: string | null;
    };
  }[];
  prescriptions: {
    id: string;
    historyEntryId: string;
    historyId: string;
    patientId: string;
    doctorId: string;
    prescriptionDate: Date;
    instructions: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    medications: {
      id: string;
      prescriptionId: string;
      medicationName: string;
      dosage: string;
      frequency: string;
      duration: string;
      notes: string | null;
    }[];
    doctor: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
};

export class HistoryEntryService {
  private prisma: TenantPrisma;
  constructor(prisma: TenantPrisma) {
    this.prisma = prisma;
  }

  async create(completeData: CreateMedicalHistoryData): Promise<CreateMedicalHistoryResult> {
    return await this.prisma.$transaction(async (tx) => {
      console.log(completeData);
      
      let medicalHistory = await tx.medicalHistory.findUnique({
        where: {
          patientId_specialtyId: {
            patientId: completeData.medicalHistoryData.patientId,
            specialtyId: completeData.medicalHistoryData.specialtyId
          }
        }
      });

      if (completeData.appointmentId) {
        const appointmentExists = await tx.appointment.findUnique({
          where: { id: completeData.appointmentId }
        });
        if (!appointmentExists) {
          throw new Error(`Appointment with ID ${completeData.appointmentId} does not exist`);
        }

        // Verificar que la cita pertenece al mismo paciente y doctor
        if (appointmentExists.patientId !== completeData.medicalHistoryData.patientId) {
          throw new Error(`Appointment does not belong to the specified patient`);
        }

        if (appointmentExists.doctorId !== completeData.historyEntryData.doctorId) {
          throw new Error(`Appointment does not belong to the specified doctor`);
        }

        // Actualizar el estado de la cita a COMPLETED
        await tx.appointment.update({
          where: { id: completeData.appointmentId },
          data: { 
            status: 'COMPLETED',
            // Opcional: agregar notas o información adicional sobre la consulta completada
            notes: completeData.appointmentNotes 
              ? `${appointmentExists.notes || ''}\n\n--- CONSULTA COMPLETADA ---\n${completeData.appointmentNotes}`
              : appointmentExists.notes
          }
        });
      }

      if (!medicalHistory) {
        medicalHistory = await tx.medicalHistory.create({
          data: completeData.medicalHistoryData
        });
      }

      // Normalize dates and boolean extended fields before creating the HistoryEntry
      const visitDate = completeData.historyEntryData.visitDate
        ? (completeData.historyEntryData.visitDate instanceof Date
            ? completeData.historyEntryData.visitDate
            : new Date(completeData.historyEntryData.visitDate))
        : undefined;

      const lastMenstrualPeriod = completeData.historyEntryData.lastMenstrualPeriod === undefined
        ? undefined
        : (completeData.historyEntryData.lastMenstrualPeriod === null
            ? null
            : (completeData.historyEntryData.lastMenstrualPeriod instanceof Date
                ? completeData.historyEntryData.lastMenstrualPeriod
                : new Date(completeData.historyEntryData.lastMenstrualPeriod)));

      const smokes = typeof completeData.historyEntryData.smokes === 'boolean' ? completeData.historyEntryData.smokes : undefined;
      const alcohol = typeof completeData.historyEntryData.alcohol === 'boolean' ? completeData.historyEntryData.alcohol : undefined;
      const drugs = typeof completeData.historyEntryData.drugs === 'boolean' ? completeData.historyEntryData.drugs : undefined;

      // Crear HistoryEntry con todos los campos extendidos
      const historyEntry = await tx.historyEntry.create({
        data: {
          historyId: medicalHistory.id,
          doctorId: completeData.historyEntryData.doctorId,
          visitDate,
          chiefComplaint: completeData.historyEntryData.chiefComplaint,
          subjectiveNote: completeData.historyEntryData.subjectiveNote,
          objectiveNote: completeData.historyEntryData.objectiveNote,
          assessment: completeData.historyEntryData.assessment,
          plan: completeData.historyEntryData.plan,
          vitals: completeData.historyEntryData.vitals,
          // Campos extendidos
          pathologicalHistory: completeData.historyEntryData.pathologicalHistory ?? undefined,
          surgicalHistory: completeData.historyEntryData.surgicalHistory ?? undefined,
          habitualMedication: completeData.historyEntryData.habitualMedication ?? undefined,
          menarcheAge: completeData.historyEntryData.menarcheAge ?? undefined,
          lastMenstrualPeriod,
          obstetricHistory: completeData.historyEntryData.obstetricHistory ?? undefined,
          diet: completeData.historyEntryData.diet ?? undefined,
          physicalActivity: completeData.historyEntryData.physicalActivity ?? undefined,
          smokes,
          alcohol,
          drugs,
          drugsDetails: completeData.historyEntryData.drugsDetails ?? undefined,
          labResults: completeData.historyEntryData.labResults ?? undefined,
          imagingResults: completeData.historyEntryData.imagingResults ?? undefined,
          otherStudies: completeData.historyEntryData.otherStudies ?? undefined,
          nonPharmacologicalTreatment: completeData.historyEntryData.nonPharmacologicalTreatment ?? undefined,
          requestedStudies: completeData.historyEntryData.requestedStudies ?? undefined,
          referrals: completeData.historyEntryData.referrals ?? undefined,
          followUp: completeData.historyEntryData.followUp ?? undefined,
        }
      });

      // ===============================
      // MODIFICACIÓN EN LA CREACIÓN DE DIAGNÓSTICOS
      // ===============================
      if (completeData.diagnoses && completeData.diagnoses.length > 0) {
        for (const diagnosis of completeData.diagnoses) {
          let diagnosisIdToUse: string;

          // Verificar si el diagnosisId es un UUID válido
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const isValidUUID = uuidRegex.test(diagnosis.diagnosisId);
          
          if (isValidUUID) {
            // Si es un UUID válido, buscar si el diagnóstico existe
            const existingDiagnosis = await tx.diagnosis.findUnique({
              where: { id: diagnosis.diagnosisId }
            });

            if (existingDiagnosis) {
              // Si existe, usar el ID existente
              diagnosisIdToUse = diagnosis.diagnosisId;
            } else {
              // Si el UUID no existe en la base de datos, lanzar error
              throw new Error(`Diagnóstico con ID ${diagnosis.diagnosisId} no encontrado`);
            }
          } else {
            // Si NO es un UUID válido, crear un nuevo diagnóstico
            // Usar el valor de diagnosisId como 'name' y como 'code'
            const newDiagnosis = await tx.diagnosis.create({
              data: {
                code: diagnosis.diagnosisId, // Usar el valor como código
                name: diagnosis.diagnosisId, // Usar el valor como nombre
                description: diagnosis.diagnosisId // Usar el valor como descripción
              }
            });
            
            diagnosisIdToUse = newDiagnosis.id;
          }

          // Crear la relación EntryDiagnosis con el ID (existente o nuevo)
          await tx.entryDiagnosis.create({
            data: {
              historyEntryId: historyEntry.id,
              diagnosisId: diagnosisIdToUse,
              isPrimary: diagnosis.isPrimary || false
            }
          });
        }
      }

      // Crear prescripciones
      if (completeData.prescriptions && completeData.prescriptions.length > 0) {
        const prescription = await tx.prescription.create({
          data: {
            historyEntryId: historyEntry.id,
            historyId: medicalHistory.id,
            patientId: completeData.medicalHistoryData.patientId,
            doctorId: completeData.historyEntryData.doctorId,
            prescriptionDate: completeData.historyEntryData.visitDate || new Date(),
            instructions: "Tomar según indicación médica",
            notes: "Prescripción generada en consulta"
          }
        });

        for (const medication of completeData.prescriptions) {
          await tx.prescriptionMedication.create({
            data: {
              prescriptionId: prescription.id,
              medicationName: medication.medicationName,
              dosage: medication.dosage,
              frequency: medication.frequency,
              duration: medication.duration,
              notes: medication.notes
            }
          });
        }
      }

      // Retornar la entrada creada con todas las relaciones
      return await tx.historyEntry.findUnique({
        where: { id: historyEntry.id },
        include: {
          history: {
            include: {
              patient: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  ciNumber: true
                }
              },
              specialty: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          diagnoses: {
            include: {
              diagnosis: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          },
          prescriptions: {
            include: {
              medications: true
            }
          }
        }
      }) as CreateMedicalHistoryResult;
    });
  }

  async getPatientMedicalHistory(patientId: string): Promise<PatientMedicalHistoryResult[]> {
    try {
      // Primero verificar que el paciente existe
      const patientExists = await this.prisma.patient.findUnique({
        where: { id: patientId }
      });

      if (!patientExists) {
        throw new Error(`Patient with ID ${patientId} does not exist`);
      }

      // Obtener todos los historiales médicos del paciente con toda la información relacionada
      const medicalHistories = await this.prisma.medicalHistory.findMany({
        where: {
          patientId: patientId
        },
        include: {
          // Información del paciente
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ciNumber: true,
              birthDate: true,
              gender: true,
              phone: true,
              email: true
            }
          },
          // Información de la especialidad
          specialty: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          // Información del usuario que creó el historial
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          // Todas las entradas del historial con relaciones completas
          entries: {
            include: {
              // Información del doctor que atendió - CORREGIDO: sin email
              doctor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                  // Removido email ya que no está en todas las consultas
                }
              },
              // Diagnósticos con información completa
              diagnoses: {
                include: {
                  diagnosis: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      description: true
                    }
                  }
                }
              },
              // Prescripciones con medicamentos
              prescriptions: {
                include: {
                  medications: true,
                  doctor: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            },
            orderBy: {
              visitDate: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return medicalHistories as unknown as PatientMedicalHistoryResult[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error retrieving patient medical history:', error);
      throw new Error(`Failed to retrieve patient medical history: ${errorMessage}`);
    }
  }

  async getPatientMedicalHistoryBySpecialty(patientId: string, specialtyId: string): Promise<PatientMedicalHistoryResult | null> {
    try {
      const medicalHistory = await this.prisma.medicalHistory.findUnique({
        where: {
          patientId_specialtyId: {
            patientId: patientId,
            specialtyId: specialtyId
          }
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              ciNumber: true,
              birthDate: true,
              gender: true,
              phone: true,
              email: true
            }
          },
          specialty: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          entries: {
            include: {
              doctor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              },
              diagnoses: {
                include: {
                  diagnosis: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                      description: true
                    }
                  }
                }
              },
              prescriptions: {
                include: {
                  medications: true,
                  doctor: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            },
            orderBy: {
              visitDate: 'desc'
            }
          }
        }
      });

      return medicalHistory as unknown as PatientMedicalHistoryResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error retrieving patient medical history by specialty:', error);
      throw new Error(`Failed to retrieve patient medical history: ${errorMessage}`);
    }
  }

  async getPatientRecentHistoryEntries(patientId: string, limit: number = 10): Promise<HistoryEntryResult[]> {
    try {
      const recentEntries = await this.prisma.historyEntry.findMany({
        where: {
          history: {
            patientId: patientId
          }
        },
        include: {
          history: {
            include: {
              patient: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  ciNumber: true
                }
              },
              specialty: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true
              // Removido email para consistencia
            }
          },
          diagnoses: {
            include: {
              diagnosis: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          },
          prescriptions: {
            include: {
              medications: true
            }
          }
        },
        orderBy: {
          visitDate: 'desc'
        },
        take: limit
      });

      return recentEntries as unknown as HistoryEntryResult[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error retrieving patient recent history entries:', error);
      throw new Error(`Failed to retrieve recent history entries: ${errorMessage}`);
    }
  }

  async list(): Promise<import('../../node_modules/.prisma/tenant-client').HistoryEntry[]> {
    return await this.prisma.historyEntry.findMany();
  }

  async detail(id: string): Promise<import('../../node_modules/.prisma/tenant-client').HistoryEntry> {
    const entry = await this.prisma.historyEntry.findUnique({ where: { id } });
    if (!entry) throw new AppError('Entrada de historia no encontrada', 404);
    return entry;
  }

  async update(id: string, data: any): Promise<import('../../node_modules/.prisma/tenant-client').HistoryEntry> {
    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.historyEntry.update({ where: { id }, data });
      return updated;
    });
  }

  async delete(id: string): Promise<import('../../node_modules/.prisma/tenant-client').HistoryEntry> {
    // Hard delete: remove the record
    return await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.historyEntry.delete({ where: { id } });
      return deleted;
    });
  }
}
