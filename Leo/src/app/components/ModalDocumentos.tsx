// components/ModalDocumentos.tsx
"use client";

import React from "react";

interface ModalDocumentosProps {
  contratoPdf: string;
  procuracaoPdf: string;
  onVoltar: () => void;
  onEnviar: () => void;
}

export default function ModalDocumentos({
  contratoPdf,
  procuracaoPdf,
  onVoltar,
  onEnviar,
}: ModalDocumentosProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center p-4 overflow-auto"
      style={{ width: "100vw", height: "100vh" }}
    >
      <h2 className="text-white text-3xl font-semibold mb-6">📄 Documentos Gerados</h2>

      <div
        className="w-full max-w-[90vw] grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto"
        style={{ height: "100vh" }}
      >
        <div className="bg-white rounded shadow-md overflow-hidden">
          <h3 className="text-gray-700 font-semibold text-center py-3 bg-gray-100 text-lg">
            Contrato
          </h3>
          <iframe
            src={`http://localhost:8000/documentos/${contratoPdf}`}
            className="w-full h-[90vh] border-0"
            title="Contrato"
          />
        </div>

        <div className="bg-white rounded shadow-md overflow-hidden">
          <h3 className="text-gray-700 font-semibold text-center py-3 bg-gray-100 text-lg">
            Procuração
          </h3>
          <iframe
            src={`http://localhost:8000/documentos/${procuracaoPdf}`}
            className="w-full h-[90vh] border-0"
            title="Procuração"
          />
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={onVoltar}
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition text-lg"
        >
          ↩️ Voltar
        </button>
        <button
          onClick={onEnviar}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-lg"
        >
          📤 Enviar Documento
        </button>
      </div>
    </div>
  );
}
