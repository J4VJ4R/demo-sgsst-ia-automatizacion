ALTER TABLE "sgsst_design_section" ADD COLUMN "fecha_vencimiento" TIMESTAMP(3);
ALTER TABLE "sgsst_design_section" ADD COLUMN "estado_vencimiento" TEXT NOT NULL DEFAULT 'Cumplido';

CREATE OR REPLACE FUNCTION sgsst_design_section_compute_estado_vencimiento(due_date TIMESTAMP)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  days_remaining INT;
BEGIN
  IF due_date IS NULL THEN
    RETURN 'Cumplido';
  END IF;
  days_remaining := (due_date::date - CURRENT_DATE);
  IF days_remaining <= 15 THEN
    RETURN 'Vencido';
  ELSIF days_remaining <= 30 THEN
    RETURN 'Por vencer';
  ELSE
    RETURN 'Cumplido';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sgsst_design_section_set_estado_vencimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.estado_vencimiento := sgsst_design_section_compute_estado_vencimiento(NEW.fecha_vencimiento);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sgsst_design_section_set_estado_vencimiento ON "sgsst_design_section";
CREATE TRIGGER trg_sgsst_design_section_set_estado_vencimiento
BEFORE INSERT OR UPDATE OF "fecha_vencimiento"
ON "sgsst_design_section"
FOR EACH ROW
EXECUTE FUNCTION sgsst_design_section_set_estado_vencimiento();

CREATE OR REPLACE FUNCTION sgsst_refresh_estado_vencimiento(p_project_id TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE "sgsst_design_section"
  SET "estado_vencimiento" = sgsst_design_section_compute_estado_vencimiento("fecha_vencimiento")
  WHERE "projectId" = p_project_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

