'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadZone } from "@/components/documents/upload-zone";
import { FileText, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPreview } from "./document-preview";

type DocumentWithActivity = {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date;
  activity: {
    title: string;
    project: {
      name: string;
    };
  };
};

type SimpleActivity = {
  id: string;
  title: string;
};

interface DocumentListProps {
  documents: DocumentWithActivity[];
  activities: SimpleActivity[];
}

export function DocumentList({ documents, activities }: DocumentListProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentWithActivity | null>(null);

  return (
    <div className="relative">
      <div className={`transition-all duration-300 ${selectedDoc ? 'w-1/2 pr-4' : 'w-full'}`}>
        <div className="grid gap-6 md:grid-cols-1">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Archivos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      {!selectedDoc && <TableHead>Actividad</TableHead>}
                      {!selectedDoc && <TableHead>Empresa</TableHead>}
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id} className={selectedDoc?.id === doc.id ? "bg-slate-50" : ""}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="truncate max-w-[200px]" title={doc.name}>{doc.name}</span>
                        </TableCell>
                        {!selectedDoc && <TableCell>{doc.activity.title}</TableCell>}
                        {!selectedDoc && <TableCell>{doc.activity.project.name}</TableCell>}
                        <TableCell>{doc.uploadedAt.toLocaleDateString('es-ES')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant={selectedDoc?.id === doc.id ? "secondary" : "ghost"} 
                              size="icon"
                              onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                              title="Previsualizar"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" asChild title="Descargar">
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {documents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={selectedDoc ? 3 : 5} className="text-center py-4 text-muted-foreground">
                          No hay documentos subidos.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {!selectedDoc && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Nuevo Documento</CardTitle>
                </CardHeader>
                <CardContent>
                  <UploadZone activities={activities} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {selectedDoc && (
        <DocumentPreview 
          key={selectedDoc.id}
          document={selectedDoc} 
          onClose={() => setSelectedDoc(null)} 
        />
      )}
    </div>
  );
}
