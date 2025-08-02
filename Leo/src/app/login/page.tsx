"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState("usuario");
  const [erro, setErro] = useState("");
  const router = useRouter();

  // ✅ Áudio reativado
  function tocarAudioComFadeOut() {
    if (typeof window === "undefined") return;

    const audio = new Audio("/audio/avengers.mp3");
    audio.volume = 1;
    audio.play().catch((err) => {
      console.warn("⚠️ Navegador bloqueou autoplay de áudio:", err.message);
    });

    setTimeout(() => {
      let volume = 1.0;
      const fadeInterval = setInterval(() => {
        if (volume <= 0.05) {
          clearInterval(fadeInterval);
          audio.pause();
          audio.currentTime = 0;
        } else {
          volume -= 0.05;
          audio.volume = volume;
        }
      }, 250);
    }, 25000);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const endpoint =
      tipo === "advogado"
        ? "http://127.0.0.1:8000/login/"
        : "http://127.0.0.1:8000/usuarios/login/";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuario.trim(), senha }),
      });

      if (!res.ok) throw new Error("Erro");

      const data = await res.json();
      localStorage.clear();

      if (tipo === "advogado") {
        localStorage.setItem("advogadoId", data.id);
        localStorage.setItem("nomeAdvogado", data.nome || "");
        localStorage.setItem("oabAdvogado", data.oab || "");
        localStorage.setItem("emailAdvogado", data.email || "");
        localStorage.setItem("perfilUsuario", "advogado");
        document.cookie = `perfilUsuario=${tipo}; path=/`;
      } else {
        localStorage.setItem("usuarioId", data.id);
        localStorage.setItem("nomeUsuario", data.nome || "");
        localStorage.setItem("emailUsuario", data.email || "");
        localStorage.setItem("perfilUsuario", data.perfil || "usuario");
      }

      tocarAudioComFadeOut(); // ✅ Ativado novamente

      router.push("/"); // ✅ Redireciona para página principal
    } catch {
      setErro("Usuário não encontrado ou senha inválida.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 px-4 text-white">
      {/* Título */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold drop-shadow-lg">
          PJMOL
        </h1>
        <p className="text-md md:text-lg mt-2">
          Programa Gerador de Ações Judiciais para Consórcios
        </p>
      </div>

      {/* Formulário de Login */}
      <div className="bg-white bg-opacity-10 backdrop-blur-md p-8 rounded-lg shadow-lg w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-6 text-center text-black">
          🔒 Login
        </h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white bg-opacity-90 text-black focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="usuario">Usuário</option>
            <option value="advogado">Advogado</option>
          </select>

          <input
            type="text"
            placeholder="Usuário (e-mail ou nome)"
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white bg-opacity-90 text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Senha"
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white bg-opacity-90 text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
          >
            Entrar
          </button>
        </form>

        <p className="text-sm mt-4 text-center text-black">
          Não tem conta?{" "}
          <a href="/criar-usuario" className="text-blue-400 hover:underline">
            Criar usuário
          </a>
        </p>
      </div>
    </div>
  );
}
