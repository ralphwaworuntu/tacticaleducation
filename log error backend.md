PS E:\TACKTICAL EDUCATION\backend> npx prisma migrate dev
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": MySQL database "tactical_education" at "localhost:3306"

The migration `20251230073731_update_system_v2_5` was modified after it was applied.
√ We need to reset the MySQL database "tactical_education" at "localhost:3306"
Do you want to continue? All data will be lost. ... yes

Applying migration `20251224081327_tactical_db`
Applying migration `20251224131349_`
Applying migration `20251225030841_update_system_v1_0_1`
Applying migration `20251227091600_update_system_v2_0`
Applying migration `20251227093000_add_user_is_active`
Applying migration `20251228093000_add_calculator_structure`
Applying migration `20251228103000_update_cermat_base_digits`
Applying migration `20251228121500_add_cermat_letter_mode`
Applying migration `20251228133000_add_announcement_image`
Applying migration `20251230073731_update_system_v2_5`

The following migration(s) have been applied:

migrations/
  └─ 20251224081327_tactical_db/
    └─ migration.sql
  └─ 20251224131349_/
    └─ migration.sql
  └─ 20251225030841_update_system_v1_0_1/
    └─ migration.sql
  └─ 20251227091600_update_system_v2_0/
    └─ migration.sql
  └─ 20251227093000_add_user_is_active/
    └─ migration.sql
  └─ 20251228093000_add_calculator_structure/
    └─ migration.sql
  └─ 20251228103000_update_cermat_base_digits/
    └─ migration.sql
  └─ 20251228121500_add_cermat_letter_mode/
    └─ migration.sql
  └─ 20251228133000_add_announcement_image/
    └─ migration.sql
  └─ 20251230073731_update_system_v2_5/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 178ms


Running seed command `ts-node --project tsconfig.json prisma/seed.ts` ...
E:\TACKTICAL EDUCATION\backend\node_modules\ts-node\src\index.ts:859
    return new TSError(diagnosticText, diagnosticCodes, diagnostics);
           ^
TSError: ⨯ Unable to compile TypeScript:
prisma/seed.ts:525:9 - error TS2322: Type 'Record<string, unknown>' is not assignable to type 'JsonNull | InputJsonValue'.
  Type 'Record<string, unknown>' is missing the following properties from type 'readonly (InputJsonValue | null)[]': length, concat, join, slice, and 20 more.

525         config: calculator.config,
            ~~~~~~

  node_modules/.prisma/client/index.d.ts:49230:5
    49230     config?: JsonNullValueInput | InputJsonValue
              ~~~~~~
    The expected type comes from property 'config' which is declared here on type '(Without<PsychCalculatorTemplateUpdateInput, PsychCalculatorTemplateUncheckedUpdateInput> & PsychCalculatorTemplateUncheckedUpdateInput) | (Without<...> & PsychCalculatorTemplateUpdateInput)'
prisma/seed.ts:538:9 - error TS2322: Type 'Record<string, unknown>' is not assignable to type 'JsonNull | InputJsonValue'.
  Type 'Record<string, unknown>' is missing the following properties from type 'readonly (InputJsonValue | null)[]': length, concat, join, slice, and 20 more.

538         config: calculator.config,
            ~~~~~~

  node_modules/.prisma/client/index.d.ts:49198:5
    49198     config: JsonNullValueInput | InputJsonValue
              ~~~~~~
    The expected type comes from property 'config' which is declared here on type '(Without<PsychCalculatorTemplateCreateInput, PsychCalculatorTemplateUncheckedCreateInput> & PsychCalculatorTemplateUncheckedCreateInput) | (Without<...> & PsychCalculatorTemplateCreateInput)'

    at createTSError (E:\TACKTICAL EDUCATION\backend\node_modules\ts-node\src\index.ts:859:12)
    at reportTSError (E:\TACKTICAL EDUCATION\backend\node_modules\ts-node\src\index.ts:863:19)
    at getOutput (E:\TACKTICAL EDUCATION\backend\node_modules\ts-node\src\index.ts:1077:36)
    at Object.compile (E:\TACKTICAL EDUCATION\backend\node_modules\ts-node\src\index.ts:1433:41)
    at Module.m._compile (E:\TACKTICAL EDUCATION\backend\node_modules\ts-node\src\index.ts:1617:30)
    at node:internal/modules/cjs/loader:1893:10
    at Object.require.extensions.<computed> [as .ts] (E:\TACKTICAL EDUCATION\backend\node_modules\ts-node\src\index.ts:1621:12)
    at Module.load (node:internal/modules/cjs/loader:1481:32)
    at Module._load (node:internal/modules/cjs/loader:1300:12)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14) {
  diagnosticCodes: [ 2322, 2322 ]
}

An error occurred while running the seed command:
Error: Command failed with exit code 1: ts-node --project tsconfig.json prisma/seed.ts