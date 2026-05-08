CREATE TABLE driver_inspection_driver (
    id TEXT NOT NULL,
    projectid TEXT NOT NULL,
    fullname TEXT NOT NULL,
    documenttype TEXT NOT NULL,
    documentnumber TEXT NOT NULL,
    position TEXT,
    licensecategory TEXT,
    licenseduedate TIMESTAMP(3),
    licensestatus TEXT,
    roadsafetytraining BOOLEAN,
    evaluationduedate TIMESTAMP(3),
    vehicleplate TEXT,
    missiontripsplanner TEXT,
    createdat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT driver_inspection_driver_pkey PRIMARY KEY (id)
);

CREATE INDEX driver_inspection_driver_projectid_idx ON driver_inspection_driver(projectid);
CREATE INDEX driver_inspection_driver_documentnumber_idx ON driver_inspection_driver(documentnumber);

ALTER TABLE driver_inspection_driver
ADD CONSTRAINT driver_inspection_driver_projectid_fkey
FOREIGN KEY (projectid) REFERENCES "Project"(id)
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE driver_inspection_document (
    id TEXT NOT NULL,
    driverid TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    key TEXT NOT NULL,
    sizebytes INTEGER,
    uploadedat TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deletedat TIMESTAMP(3),

    CONSTRAINT driver_inspection_document_pkey PRIMARY KEY (id)
);

CREATE INDEX driver_inspection_document_driverid_idx ON driver_inspection_document(driverid);
CREATE INDEX driver_inspection_document_deletedat_idx ON driver_inspection_document(deletedat);

ALTER TABLE driver_inspection_document
ADD CONSTRAINT driver_inspection_document_driverid_fkey
FOREIGN KEY (driverid) REFERENCES driver_inspection_driver(id)
ON DELETE CASCADE ON UPDATE CASCADE;

