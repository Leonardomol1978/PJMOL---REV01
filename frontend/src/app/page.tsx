"use client";

import { useEffect, useState } from "react";
import { NumericFormat, PatternFormat } from "react-number-format";
import axios from "axios";
import ModalDocumentos from "@/app/components/ModalDocumentos";
import { useRouter } from "next/navigation";
import { formatarParaBR } from "@/utils/datas";

// 🧠 Funções utilitárias



function formatarComarca(comarca: string | undefined): string {
  if (!comarca) return "";
  return comarca.replace(/^COMARCA DE\s+/i, "").trim();
}

function normalizarData(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function getCorComarcaPeloTexto(comarca: string | undefined, selecionada: boolean): string {
  const risco = classificarRiscoPelaComarca(comarca);

  return [
    "border p-2 rounded cursor-pointer transition duration-150 ease-in-out",
    risco === "bom" && "bg-green-100 border-green-400",
    risco === "ruim" && "bg-red-100 border-red-400",
    risco === "neutro" && "border-gray-300",
    selecionada && "ring-2 ring-blue-500"
  ]
    .filter(Boolean)
    .join(" ");
}

function classificarRiscoPelaComarca(comarca: string | undefined): "bom" | "ruim" | "neutro" {
  if (!comarca) return "neutro";
  const texto = comarca.toUpperCase();
  if (texto.includes("RJ") || texto.includes("MATO GROSSO") || texto.includes("MT")) {
    return "ruim";
  }
  return "bom";
}

function aplicarMascara(campo: string, valor: string): string {
  const numeros = valor.replace(/\D/g, "");

  switch (campo) {
    case "cpf":
      return numeros
        .slice(0, 11)
        .replace(/(\d{3})(\d{0,3})(\d{0,3})(\d{0,2})/, (_, a, b, c, d) =>
          [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : "")
        );

    case "cnpj":
      return numeros
        .slice(0, 14)
        .replace(/(\d{2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})/, (_, a, b, c, d, e) =>
          `${a}.${b}.${c}/${d}-${e}`.replace(/[-/.]+$/, "")
        );

    case "cpf_cnpj":
      return numeros.length <= 11
        ? aplicarMascara("cpf", numeros)
        : aplicarMascara("cnpj", numeros);

    case "cep":
      return numeros
        .slice(0, 8)
        .replace(/(\d{5})(\d{0,3})/, (_, a, b) => (b ? `${a}-${b}` : a));

    case "telefone":
      return numeros
        .slice(0, 11)
        .replace(/^(\d{2})(\d{0,5})(\d{0,4})/, (_, a, b, c) =>
          `(${a}) ${b}${c ? `-${c}` : ""}`
        );

    default:
      return valor;
  }
}

function converterParaInputDate(data: string | undefined): string {
  if (!data) return "";
  if (data.includes("-")) return data;
  if (data.includes("/")) {
    const [dia, mes, ano] = data.split("/");
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }
  return "";
}

// 📌 Interface
interface Advogado {
  id: number;
  nome_completo: string;
  usuario: string;
  oab: string;
}

// ✅ Componente principal da página com proteção
export default function Page() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [etapa, setEtapa] = useState("upload");
  const [listaAdvogados, setListaAdvogados] = useState<Advogado[]>([]);

  useEffect(() => {
    const perfil = localStorage.getItem("perfilUsuario");
    if (!perfil) {
      router.push("/login");
    } else {
      setCarregando(false);
    }
  }, []);

  const formatarReais = (valor: number | string | undefined): string => {
    const numero = Number(valor);
    if (isNaN(numero)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numero);
  };

  // 👉 ATUALIZADO: função que valida os campos obrigatórios
  function camposObrigatoriosFaltando(
    dadosBasicos: any,
    dadosManuais: any,
    parcelas: any[]
  ): string[] {
    const faltando: string[] = [];

    const nome = dadosBasicos.nome_cliente?.trim();
    const cpf = dadosBasicos.cpf_cnpj?.replace(/\D/g, "");
    const telefoneNumeros = (dadosManuais.telefone || "").replace(/\D/g, "");
    const honorarios = dadosManuais.honorarios_percentual;
    const comarca = dadosManuais.comarca_escolhida?.trim();
  

  // Validação dos campos obrigatórios
  if (!nome) faltando.push("Nome");
  if (!cpf || cpf.length < 11) faltando.push("CPF/CNPJ");
  if (!telefoneNumeros || telefoneNumeros.length < 10 || telefoneNumeros.length > 11) {
    faltando.push("Telefone");
  }
  if (!honorarios || Number(honorarios) <= 0) faltando.push("Honorários");
  if (!comarca) faltando.push("Comarca");

  // Validação da soma das parcelas
  const somaParcelas = parcelas.reduce((acc, p) => acc + Number(p.valor_pago || 0), 0);
  const total = Number(dadosBasicos.valor_total_pago_extrato || 0);
  if (Math.abs(total - somaParcelas) > 0.01) {
    faltando.push("Soma das parcelas não confere com o valor do extrato");
  }

  return [...new Set(faltando)];
}

function verificarCamposObrigatoriosDOM(): string[] {
  const camposObrigatorios = document.querySelectorAll("[data-obrigatorio]");
  const camposIncompletos: string[] = [];

  camposObrigatorios.forEach((campo) => {
    const input = campo as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const nomeCampo = input.closest("div")?.querySelector("label")?.innerText || "Campo obrigatório";

    const valor = (input.value || "").trim();

    // Verificação específica para telefones ou campos mascarados (ex: PatternFormat)
    const tipo = input.getAttribute("type");
    const minimo = input.getAttribute("minlength");

    if (
      !valor ||
      (tipo === "number" && Number(valor) <= 0) ||
      (minimo && valor.length < parseInt(minimo))
    ) {
      camposIncompletos.push(nomeCampo.replace("*", "").trim());
    }
  });

  return [...new Set(camposIncompletos)];
}


const [dadosAdvogado, setDadosAdvogado] = useState<{ nome_completo?: string }>({});

useEffect(() => {
  const nomeElement = document.querySelector("strong.text-gray-900");
  if (nomeElement) {
    const nome = nomeElement.textContent?.trim() || "";
    const usuario = nome.split(" ")[0].toLowerCase(); // ex: "leonardo"

    localStorage.setItem("nomeAdvogado", nome);
    localStorage.setItem("usuarioAdvogado", usuario);

    console.log("✅ Advogado identificado:", nome, "→", usuario);
  } else {
    console.warn("⚠️ Elemento com o nome do advogado não encontrado.");
  }
}, []);



useEffect(() => {
  const advogadoId = localStorage.getItem("advogadoId");
  if (!advogadoId) return;

  axios.get(`http://localhost:8000/advogados/${advogadoId}`)
    .then((res) => {
      setDadosAdvogado(res.data);
      setDadosManuais((prev) => ({
        ...prev,
        advogado: res.data.nome_completo,  // para usar nos documentos
      }));
    })
    .catch((err) => {
      console.error("Erro ao buscar dados do advogado:", err);
    });
}, []);

  const [parcelas, setParcelas] = useState<{
    data_pagamento: string;
    valor_pago: number;
    tipo?: string;
    valor_corrigido_hoje?: number;
    valor_corrigido_futuro?: number;
    taxa_adm_parcela?: number;
  }[]>([]);

  const [filtro, setFiltro] = useState("");
  const [novaParcela, setNovaParcela] = useState({ data_pagamento: "", valor_pago: "", tipo: "parcela" });
  const [resultadoJurosHoje, setResultadoJurosHoje] = useState<number | null>(null);
  const [resultadoJurosFuturo, setResultadoJurosFuturo] = useState<number | null>(null);
  const [resultadoTaxaAdmDevidaValor, setResultadoTaxaAdmDevidaValor] = useState<number | null>(null);
  const [resultadoTaxaAdmDevidaPercentual, setResultadoTaxaAdmDevidaPercentual] = useState<number | null>(null);
  const [precisaCalcular, setPrecisaCalcular] = useState(false);
  const [indiceAteHoje, setIndiceAteHoje] = useState("TJMG");
  const [indiceFuturo, setIndiceFuturo] = useState("TJMG");
  const [comarcaSelecionada, setComarcaSelecionada] = useState<"cliente" | "administradora" | null>(null);
  const getCorComarca = (origem: "cliente" | "administradora") => {
  const risco = classificarRiscoEstado(dadosBasicos.estado);
  const selecionada = comarcaSelecionada === origem;
  


  useEffect(() => {
  async function buscarAdvogados() {
    try {
      const res = await axios.get("http://localhost:8000/advogados/");
      setListaAdvogados(res.data);
    } catch (error) {
      console.error("Erro ao buscar advogados:", error);
    }
  }

  buscarAdvogados();
}, []);
 
    

  return [
    "border p-2 rounded cursor-pointer transition duration-150 ease-in-out",
    risco === "bom" && "bg-green-100 border-green-400",
    risco === "ruim" && "bg-red-100 border-red-400",
    risco === "neutro" && "border-gray-300",
    selecionada && "ring-2 ring-blue-500"
  ].filter(Boolean).join(" ");
};

const classificarRiscoEstado = (estado: string): "bom" | "ruim" | "neutro" => {
  const estadosBons = ["MG", "SP", "PR"];
  const estadosRuins = ["RJ", "AM", "PA"];

  if (estadosBons.includes(estado)) return "bom";
  if (estadosRuins.includes(estado)) return "ruim";
  return "neutro";
};

  const handleUploadContrato = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("arquivo", file);

  try {
    const response = await fetch("http://localhost:8000/extrair-contato-contrato", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Erro ao extrair dados do contrato");
    }

    const data = await response.json();
    if (data.telefone) {
      setTelefoneCliente(data.telefone);
      setTelefoneHabilitado(true);
    }
    if (data.email) {
      setEmailCliente(data.email);
      setEmailClienteHabilitado(true);
    }
  } catch (err) {
    console.error(err);
    alert("Não foi possível extrair telefone ou e-mail do contrato.");
  }
};


  const [dadosBasicos, setDadosBasicos] = useState({
    grupo: "",
    cota: "",
    nome_cliente: "",
    cpf_cnpj: "",
    tipo_documento: "",
    taxa_adm_percentual: 0,
    total_parcelas_plano: 0,
    data_encerramento: "",
    data_primeira_assembleia: "",
    valor_total_pago_extrato: 0,
    valor_credito: 0,
    administradora: "",
    cep: "",
    cidade: "",
    estado: "",
    rua: "", // ✅ NOVO
    numero: "", // ✅ NOVO
    bairro: "",
    complemento: "", // ✅ NOVO
    nacionalidade: "", // ✅ NOVO
    comarca_cliente: "", // ✅ NOVO (já está sendo usado)
    comarca_administradora: "", // ✅ NOVO (já está sendo usado)
    taxa_adm_cobrada_valor: 0,
    percentual_taxa_adm_cobrada: 0,
    valor_taxa_adm_cobrada: 0,
    fundo_comum: 0,
    fundo_reserva: 0,
    seguros: 0,
    multas: 0,
    juros: 0,
    adesao: 0,
    outros_valores: 0,
    cnpj_administradora: "",
    numero_contrato: "",
  });

    const [telefoneCliente, setTelefoneCliente] = useState("");
    const [emailCliente, setEmailCliente] = useState("");
    const [telefoneHabilitado, setTelefoneHabilitado] = useState(false);
    const [emailClienteHabilitado, setEmailClienteHabilitado] = useState(false);
    const [emailInvalido, setEmailInvalido] = useState(false);
    const [telefoneInvalido, setTelefoneInvalido] = useState(false);
    const [houveAcordo, setHouveAcordo] = useState(false);
    const [valorAcordo, setValorAcordo] = useState("");
    const [houveSentenca, setHouveSentenca] = useState(false);
    const [tipoSentenca, setTipoSentenca] = useState(""); // "avista" ou "futuro"
    const [valorSentenca, setValorSentenca] = useState("");
    const [custasProcessuais, setCustasProcessuais] = useState<
  { data: string; valor: number; descricao?: string }[]
>([]);
  const [valoresCalculados, setValoresCalculados] = useState(false);
  const [valorSelecionado, setValorSelecionado] = useState<string | null>(null);
  const [advogados, setAdvogados] = useState<any[]>([]);
  const [advogadoSelecionado, setAdvogadoSelecionado] = useState<string>("");

  useEffect(() => {
  const perfil = localStorage.getItem("perfilUsuario");
  if (perfil === "admin") {
    axios.get("http://localhost:8000/advogados/")
      .then((res) => setAdvogados(res.data))
      .catch((err) => console.error("Erro ao buscar advogados:", err));
  }
}, []);

   

  const [dadosManuais, setDadosManuais] = useState({
  telefone: "",
  advogado: "",
  nacionalidade: "",
  numero_processo: "",
  usuario_advogado: "",
  honorarios_percentual: "",
  fase_processo: "",
  magistrado: "",
  valor_corrigido: "",
  valor_futuro: "",
  data_inicio_juros: "",
  taxa_juros_percentual: "",
  houve_sentenca: false,
  data_sentenca: "",
  valor_outros_custos: "0",
  taxa_administracao_deduzida: "0",
  // ✅ Adições abaixo
  justica_gratuita: false,
  renda_mensal: 0,
  tipo_justica: "",
  ganho_sucumbencia: "",
  perda_sucumbencia: "",
  comarca_escolhida: "", // ✅ esta linha resolve o erro
  indice_corrigido_hoje: indiceAteHoje,
  indice_corrigido_futuro: indiceFuturo,
});


const [documentosGerados, setDocumentosGerados] = useState<{
  contrato_pdf: string;
  procuracao_pdf: string;
} | null>(null);

const [mostrarModal, setMostrarModal] = useState(false);

useEffect(() => {
  const inputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    'input[data-obrigatorio], select[data-obrigatorio]'
  );

  inputs.forEach((el) => {
    const valor = el.value.trim();
    if (!valor) {
      el.classList.add('border-red-500');
      el.classList.remove('border-gray-300');
    } else {
      el.classList.remove('border-red-500');
      el.classList.add('border-gray-300');
    }
  });
}, [dadosManuais]);

useEffect(() => {
  const cepLimpo = dadosBasicos.cep?.replace(/\D/g, "");
  if (cepLimpo?.length === 8) {
    fetch(`http://localhost:8000/comarca-por-cep/${cepLimpo}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.comarca) {
          setDadosBasicos((prev) => ({
            ...prev,
            comarca_cliente: data.comarca,
          }));
        }
      })
      .catch(() => console.warn("❌ Erro ao buscar comarca por CEP"));
  }
}, [dadosBasicos.cep]);

// 1. Se tiver nome da administradora, mas CNPJ estiver vazio → buscar CNPJ + comarca
useEffect(() => {
  const nome = dadosBasicos.administradora?.trim();
  const cnpjVazio = !dadosBasicos.cnpj_administradora;

  if (nome && cnpjVazio) {
    fetch("http://localhost:8000/cnpj-por-administradora", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome_administradora: nome }),
    })
      .then((res) => res.json())
      .then((data) => {
        const cnpj = data?.cnpj?.replace(/\D/g, "");
        if (cnpj?.length === 14) {
          const formatado = aplicarMascara("cnpj", cnpj);
          setDadosBasicos((prev) => ({
            ...prev,
            cnpj_administradora: formatado,
          }));
        }
      })
      .catch((err) => {
        console.warn("⚠️ Erro ao buscar CNPJ da administradora:", err);
      });
  }
}, [dadosBasicos.administradora]);

// 2. Sempre que o CNPJ mudar, buscar nome da administradora + comarca
useEffect(() => {
  const cnpj = dadosBasicos.cnpj_administradora?.replace(/\D/g, "");

  if (cnpj?.length === 14) {
    fetch(`http://localhost:8000/administradora-por-cnpj/${cnpj}`)
      .then((res) => res.json())
      .then((data) => {
        setDadosBasicos((prev) => ({
          ...prev,
          administradora: data.administradora || prev.administradora,
          comarca_administradora: data.comarca || prev.comarca_administradora,
        }));
      })
      .catch(() => {
        console.warn("❌ Erro ao buscar administradora por CNPJ");
      });
  }
}, [dadosBasicos.cnpj_administradora]);


  useEffect(() => {
  // Sempre que qualquer campo de dadosManuais ou dadosBasicos mudar, ativa o flag
  if (etapa === "analise") {
    setPrecisaCalcular(true);
  }
}, [JSON.stringify(dadosManuais), JSON.stringify(dadosBasicos)]);

useEffect(() => {
  if (!precisaCalcular || etapa !== "analise") return;

  const timeout = setTimeout(() => {
    try {
      calcularValores();
      setPrecisaCalcular(false); // Zera a flag após calcular
    } catch (erro) {
      console.error("❌ Erro ao calcular automaticamente:", erro);
    }
  }, 600); // aguarda 600ms para evitar múltiplos cálculos rápidos

  return () => clearTimeout(timeout);
}, [precisaCalcular, etapa]);

useEffect(() => {
  if (etapa === "analise") {
    setPrecisaCalcular(true);
  }
}, [JSON.stringify(parcelas)]);

useEffect(() => {
  const perfil = localStorage.getItem("perfil"); // "advogado" ou "admin"
  const nomeAdvogado = localStorage.getItem("nomeAdvogado") || "";
  const oabAdvogado = localStorage.getItem("oabAdvogado") || "";

  if (perfil === "advogado") {
    setDadosManuais((prev) => ({
      ...prev,
      advogado: nomeAdvogado,
      advogado_oab: oabAdvogado,
    }));
  }
}, []);

  useEffect(() => {
    setDadosBasicos((prev) => ({
      ...prev,
      cpf_cnpj: aplicarMascara("cpf_cnpj", prev.cpf_cnpj || ""),
      cep: aplicarMascara("cep", prev.cep || ""),
    }));
  }, [dadosBasicos.cpf_cnpj, dadosBasicos.cep]);

  useEffect(() => {
    setDadosManuais((prev) => ({
      ...prev,
      telefone: aplicarMascara("telefone", prev.telefone || ""),
    }));
  }, [dadosManuais.telefone]);

  useEffect(() => {
  const deveZerarCustas =
    dadosManuais.tipo_justica !== "Justiça Comum" || dadosManuais.justica_gratuita;

  if (deveZerarCustas && custasProcessuais.length > 0) {
    setCustasProcessuais([]);
  }
}, [dadosManuais.tipo_justica, dadosManuais.justica_gratuita]);

useEffect(() => {
  const perfil = localStorage.getItem("perfil");
  const nomeAdvogado = localStorage.getItem("nomeAdvogado") ?? "";
  const oabAdvogado = localStorage.getItem("oabAdvogado") ?? "";

  if (perfil === "advogado") {
    setDadosManuais((prev) => ({
      ...prev,
      advogado: nomeAdvogado,
      advogado_oab: oabAdvogado,
    }));
  }
}, []);



useEffect(() => {
  const cepLimpo = dadosBasicos.cep?.replace(/\D/g, "");
  if (cepLimpo?.length === 8) {
    // Limpa os campos antes da tentativa de preenchimento
    setDadosBasicos((prev) => ({
      ...prev,
      rua: "",
      bairro: "",
      cidade: "",
      estado: "",
      comarca_cliente: "",
    }));

    fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.erro) {
          setDadosBasicos((prev) => ({
            ...prev,
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
          }));

          // Busca a comarca
          fetch(`http://localhost:8000/comarca-por-cep/${cepLimpo}`)
            .then((res) => res.json())
            .then((comarcaData) => {
              if (comarcaData.comarca) {
                setDadosBasicos((prev) => ({
                  ...prev,
                  comarca_cliente: comarcaData.comarca,
                }));
              }
            })
            .catch(() => console.warn("❌ Erro ao buscar comarca por CEP"));
        }
      })
      .catch(() => {
        // Mantém em branco se houver erro
        setDadosBasicos((prev) => ({
          ...prev,
          rua: "",
          bairro: "",
          cidade: "",
          estado: "",
          comarca_cliente: "",
        }));
        console.warn("❌ Erro ao buscar endereço pelo CEP");
      });
  }
}, [dadosBasicos.cep]);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("http://localhost:8000/extrair", {
      method: "POST",
      body: formData,
    });

    const resultado = await response.json();
    const dadosConvertidos = { ...resultado.dados_basicos };

    [
      "fundo_comum",
      "fundo_reserva",
      "seguros",
      "multas",
      "juros",
      "adesao",
      "outros_valores",
      "taxa_adm_cobrada_valor",
      "percentual_taxa_adm_cobrada",
      "valor_taxa_adm_cobrada",
    ].forEach((campo) => {
      dadosConvertidos[campo] = Number(dadosConvertidos[campo] || 0);
    });

    setDadosBasicos((prev) => ({
      ...prev,
      ...dadosConvertidos,
    }));

    setParcelas(resultado.parcelas);
    setEtapa("analise");
    setTimeout(() => {
  if (etapa === "analise") {
    try {
      calcularValores();
    } catch (erro) {
      console.error("❌ Erro ao calcular após extrair:", erro);
    }
  }
}, 300);
  };

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [links, setLinks] = useState<{ pdf?: string; json?: string; excel?: string }>({});

  const enviarPDF = async () => {
    if (!arquivo) return;

    setEtapa("upload");
    setLinks({});
    setMensagem("⏳ Processando PDF...");
    setParcelas([]);

    setDadosBasicos({
      grupo: "",
      cota: "",
      nome_cliente: "",
      cpf_cnpj: "",
      tipo_documento: "",
      taxa_adm_percentual: 0,
      total_parcelas_plano: 0,
      data_encerramento: "",
      data_primeira_assembleia: "",
      valor_total_pago_extrato: 0,
      valor_credito: 0,
      administradora: "",
      cep: "",
      cidade: "",
      estado: "",
      rua: "", // ✅ NOVO
      numero: "", // ✅ NOVO
      bairro: "",
      complemento: "", // ✅ NOVO
      nacionalidade: "", // ✅ NOVO
      comarca_cliente: "", // ✅ NOVO (já está sendo usado)
      comarca_administradora: "", // ✅ NOVO (já está sendo usado)
      taxa_adm_cobrada_valor: 0,
      percentual_taxa_adm_cobrada: 0,
      valor_taxa_adm_cobrada: 0,
      fundo_comum: 0,
      fundo_reserva: 0,
      seguros: 0,
      multas: 0,
      juros: 0,
      adesao: 0,
      outros_valores: 0,
      cnpj_administradora: '',
      numero_contrato: "",
    });

    setDadosManuais({
  telefone: "",
  advogado: "",
  nacionalidade: "",
  numero_processo: "",
  usuario_advogado: "",
  honorarios_percentual: "",
  fase_processo: "",
  magistrado: "",
  valor_corrigido: "",
  valor_futuro: "",
  data_inicio_juros: "",
  taxa_juros_percentual: "",
  houve_sentenca: false,
  data_sentenca: "",
  valor_outros_custos: "0",
  taxa_administracao_deduzida: "0",
  // ✅ Adições abaixo
  justica_gratuita: false,
  renda_mensal: 0,
  tipo_justica: "",
  ganho_sucumbencia: "",
  perda_sucumbencia: "",
  comarca_escolhida: "", // ✅ esta linha resolve o erro
  indice_corrigido_hoje: indiceAteHoje,
  indice_corrigido_futuro: indiceFuturo,
});

    const formData = new FormData();
    formData.append("file", arquivo);

    try {
      const resposta = await fetch("http://localhost:8000/extrair", {
        method: "POST",
        body: formData,
      });
      const resultado = await resposta.json();
      console.log("🔍 Resultado do backend:", resultado);

      if (resposta.ok) {
        setMensagem("✅ PDF processado!");
        const parcelasComTipo = (resultado.parcelas || []).map((p: any) => ({ ...p, tipo: "parcela" }));
        setParcelas(parcelasComTipo);
        setDadosBasicos((prev) => ({
          ...prev,
          ...resultado.dados_basicos,
          cpf_cnpj: aplicarMascara("cpf_cnpj", resultado.dados_basicos?.cpf_cnpj || ""),
          cep: aplicarMascara("cep", resultado.dados_basicos?.cep || ""),
        }));
        setEtapa("analise");
        setResultadoJurosHoje(null);
        setResultadoJurosFuturo(null);
      } else {
        setMensagem("❌ Erro: " + resultado.detail);
      }
    } catch (e) {
      console.error(e);
      setMensagem("❌ Falha ao conectar com o backend.");
    }
  };

const calcularValores = async () => {
  setMensagem("⏳ Calculando valores...");
  try {
    const resposta = await fetch("http://localhost:8000/calcular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parcelas,
        dados_basicos: dadosBasicos,
        dados_manuais: dadosManuais,
      }),
    });

    const resultado = await resposta.json();
    console.log("Resposta do backend /calcular:", resultado);
 

    if (!resposta.ok) {
      const erroDetalhado = resultado.detail || JSON.stringify(resultado);
      setMensagem("❌ Erro no cálculo: " + erroDetalhado);
      return;
    }

    if (resultado.parcelas_corrigidas) {
      setMensagem("✅ Valores calculados!");

      const parcelasAtualizadas = parcelas.map((p, i) => {
        const corrigidoHoje = resultado.parcelas_corrigidas[i]?.valor_corrigido_hoje || 0;
        const corrigidoFuturo = resultado.parcelas_corrigidas[i]?.valor_corrigido_futuro || 0;
        const valorFuturoFinal = dadosManuais.houve_sentenca ? corrigidoHoje : corrigidoFuturo;

        return {
          ...p,
          valor_corrigido_hoje: corrigidoHoje,
          valor_corrigido_futuro: valorFuturoFinal,
        };
      });

      setParcelas(parcelasAtualizadas);

      const valorHoje = resultado.valor_corrigido_hoje_liquido?.toString() || "";
      const valorFuturo = dadosManuais.houve_sentenca
        ? valorHoje
        : resultado.valor_corrigido_futuro_liquido?.toString() || "";

      const taxaAdm = resultado.taxa_administracao_deduzida?.toString() || "0";

      setDadosManuais((dm) => ({
        ...dm,
        valor_corrigido: valorHoje,
        valor_futuro: valorFuturo,
        taxa_administracao_deduzida: taxaAdm,
      }));

      // ✅ Calcular e armazenar o Total a Ser Restituído
      const valorRestituir =
        dadosBasicos.valor_total_pago_extrato - (resultado.taxa_adm_devida_valor || 0);

      setDadosBasicos((prev) => ({
        ...prev,
        valor_a_restituir: valorRestituir,
      }));

      // 👉 Armazena os valores com juros compostos (se já adicionou os useState)
      setResultadoJurosHoje(resultado.valor_com_juros_hoje || 0);
      setResultadoJurosFuturo(resultado.valor_com_juros_futuro || 0);
      console.log("✅ Resultado backend:", resultado);
      setResultadoTaxaAdmDevidaValor(resultado.taxa_adm_devida_valor || 0);
      setResultadoTaxaAdmDevidaPercentual(resultado.taxa_adm_devida_percentual || 0);
    } else {
      setMensagem("❌ Erro ao calcular: dados incompletos.");
    }
  } catch (e: any) {
    console.error(e);
    setMensagem("❌ Falha ao conectar com o backend.");
  }
};


  const novaConsulta = () => {
    setEtapa("upload");
    setParcelas([]);
    setDadosBasicos({
    grupo: "",
    cota: "",
    nome_cliente: "",
    cpf_cnpj: "",
    tipo_documento: "",
    taxa_adm_percentual: 0,
    total_parcelas_plano: 0,
    data_encerramento: "",
    data_primeira_assembleia: "",
    valor_total_pago_extrato: 0,
    valor_credito: 0,
    administradora: "",
    cep: "",
    cidade: "",
    estado: "",
    rua: "", // ✅ NOVO
    numero: "", // ✅ NOVO
    bairro: "",
    complemento: "", // ✅ NOVO
    nacionalidade: "", // ✅ NOVO
    comarca_cliente: "", // ✅ NOVO (já está sendo usado)
    comarca_administradora: "", // ✅ NOVO (já está sendo usado)
    taxa_adm_cobrada_valor: 0, // ✅ NOVO campo incluído
    percentual_taxa_adm_cobrada: 0, // ✅ adicionado
    valor_taxa_adm_cobrada: 0,
    fundo_comum: 0,
    fundo_reserva: 0,
    seguros: 0,
    multas: 0,
    juros: 0,
    adesao: 0,
    outros_valores: 0,
    cnpj_administradora: '',
    numero_contrato: "",
  });
    setMensagem("");
    setLinks({});
    setArquivo(null);
    setDadosManuais({
  telefone: "",
  advogado: "",
  nacionalidade: "",
  numero_processo: "",
  usuario_advogado: "",
  honorarios_percentual: "",
  fase_processo: "",
  magistrado: "",
  valor_corrigido: "",
  valor_futuro: "",
  data_inicio_juros: "",
  taxa_juros_percentual: "",
  houve_sentenca: false,
  data_sentenca: "",
  valor_outros_custos: "0",
  taxa_administracao_deduzida: "0",
  // ✅ Adições abaixo
  justica_gratuita: false,
  renda_mensal: 0,
  tipo_justica: "",
  ganho_sucumbencia: "",
  perda_sucumbencia: "",
  comarca_escolhida: "", // ✅ esta linha resolve o erro
  indice_corrigido_hoje: indiceAteHoje,
  indice_corrigido_futuro: indiceFuturo,
});
  };

// 👉 ATUALIZADO: inclui complemento
const montarEnderecoCliente = (dadosBasicos: any) => {
  const rua = dadosBasicos.rua || "";
  const numero = dadosBasicos.numero || "";
  const complemento = dadosBasicos.complemento || "";
  const bairro = dadosBasicos.bairro || "";
  const cidade = dadosBasicos.cidade || "";
  const estado = dadosBasicos.estado || "";
  const cep = dadosBasicos.cep || "";
  return `${rua}, ${numero}${complemento ? " - " + complemento : ""} - ${bairro} - ${cidade}/${estado} - CEP ${cep}`;
};

const dataExtenso = new Date().toLocaleDateString("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const gerarDocumentosWord = async () => {
  try {
    const dataExtenso = new Date().toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const montarEnderecoCliente = () => {
      const rua = dadosBasicos.rua || "";
      const numero = dadosBasicos.numero || "";
      const complemento = dadosBasicos.complemento || "";
      const bairro = dadosBasicos.bairro || "";
      const cidade = dadosBasicos.cidade || "";
      const estado = dadosBasicos.estado || "";
      const cep = dadosBasicos.cep || "";

      return `${rua}, ${numero}${complemento ? " - " + complemento : ""} - ${bairro} - ${cidade}/${estado} - CEP ${cep}`;
    };

    if (!dadosManuais.comarca_escolhida) {
      alert("⚠️ Por favor, selecione a comarca.");
      return;
    }
function isoParaBR(dataIso: string | undefined): string {
  if (!dataIso) return "";
  const partes = dataIso.split("-");
  if (partes.length !== 3) return "";
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}


const payload = {
  nome: dadosBasicos.nome_cliente,
  cpf: dadosBasicos.cpf_cnpj,
  endereco_cliente: montarEnderecoCliente(),
  cidade: dadosBasicos.cidade,
  estado: dadosBasicos.estado,
  cidade_estado_cliente: `${dadosBasicos.cidade}/${dadosBasicos.estado}`,
  comarca: dadosManuais.comarca_escolhida,
  comarca_escolhida: dadosManuais.comarca_escolhida,
  telefone: dadosManuais.telefone,
  nacionalidade: dadosBasicos.nacionalidade || "Brasileiro",
  advogado_nome: localStorage.getItem("nomeAdvogado") || dadosManuais.advogado,
  advogado_oab: localStorage.getItem("oabAdvogado") || "",
  percentual_honorarios: dadosManuais.honorarios_percentual + "%",
  data_contrato: dataExtenso,
  data_procuracao: dataExtenso,
  administradora: dadosBasicos.administradora,
  data_encerramento: isoParaBR(dadosBasicos.data_encerramento),
  usuario_advogado: localStorage.getItem("usuarioAdvogado") || dadosManuais.usuario_advogado || "",
};

    console.log("📦 Payload enviado:", payload);

    const resposta = await fetch("http://localhost:8000/gerar-documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const resultado = await resposta.json(); // <- mesmo se erro

    setDocumentosGerados({
      contrato_pdf: resultado.contrato_pdf,
      procuracao_pdf: resultado.procuracao_pdf,
    });
    setMostrarModal(true);

    

    if (!resposta.ok) {
      console.error("❌ Erro no backend:", resultado);
      alert("Erro ao gerar documentos: " + (resultado?.detail || "Erro desconhecido."));
      return;
    }

    console.log("✅ Resultado do backend:", resultado);
    alert(`✅ Documentos gerados:\n- ${resultado.contrato_pdf}\n- ${resultado.procuracao_pdf}`);
  } catch (erro) {
    console.error("❌ Erro inesperado:", erro);
    alert("Erro inesperado ao gerar documentos.");
  }
};




  const salvarEAvaliar = () => setEtapa("analise");

  const excluirParcela = (index: number) => {
    setParcelas(parcelas.filter((_, i) => i !== index));
  };

  const alterarParcela = (index: number, campo: string, valor: string) => {
    setParcelas((prev) => {
      const novas = [...prev];
      novas[index] = {
        ...novas[index],
        [campo]: campo === "valor_pago" ? parseFloat(valor.replace(",", ".")) : valor,
      };
      return novas;
    });
  };

  const incluirParcela = () => {
    if (!novaParcela.data_pagamento || !novaParcela.valor_pago) return;
    setParcelas((prev) => [
      ...prev,
      {
        data_pagamento: novaParcela.data_pagamento,
        valor_pago: parseFloat(novaParcela.valor_pago.replace(",", ".")),
        tipo: novaParcela.tipo || "parcela",
      },
    ]);
    setNovaParcela({ data_pagamento: "", valor_pago: "", tipo: "parcela" });
  };

  const soma = parcelas.reduce((acc, p) => acc + p.valor_pago, 0);
  const diferenca = parseFloat((dadosBasicos.valor_total_pago_extrato - soma).toFixed(2));
  const parcelasRealmentePagas = parcelas.filter((p) => p.tipo === "parcela").length;
  const parcelasFiltradas = parcelas.filter((p) => p.data_pagamento.includes(filtro));
  

  const totalCorrigidoHoje = parcelas.reduce((acc, p) => acc + (p.valor_corrigido_hoje || 0), 0);
  const totalCorrigidoFuturo = parcelas.reduce((acc, p) => acc + (p.valor_corrigido_futuro || 0), 0);
  const totalTaxaAdmParcela = parcelas.reduce((acc, p) => acc + (p.taxa_adm_parcela || 0), 0);

  const honorarioPercentual = parseFloat(dadosManuais.honorarios_percentual.replace("%", "")) || 0;
  const baseHoje = houveAcordo
    ? parseFloat(valorAcordo || "0")
    : houveSentenca && tipoSentenca === "avista"
    ? parseFloat(valorSentenca || "0")
    : resultadoJurosHoje || 0;

  const baseFuturo = houveAcordo || (houveSentenca && tipoSentenca === "avista")
    ? 0
    : resultadoJurosFuturo || 0;

  const valorBaseHoje = houveAcordo
    ? parseFloat(valorAcordo || "0")
    : houveSentenca && tipoSentenca === "avista"
    ? parseFloat(valorSentenca || "0")
    : resultadoJurosHoje || 0;

  const valorBaseFuturo = houveAcordo || (houveSentenca && tipoSentenca === "avista")
    ? 0
    : resultadoJurosFuturo || 0;

  const totalHonorariosHoje = valorBaseHoje * (honorarioPercentual / 100);
  const totalHonorariosFuturo = valorBaseFuturo * (honorarioPercentual / 100);
  const totalCustasProcessuais = 
  dadosManuais.tipo_justica === "Justiça Comum" && !dadosManuais.justica_gratuita
    ? custasProcessuais.reduce((acc, c) => acc + c.valor, 0)
    : 0;


  const metadeHonorarioHoje = totalHonorariosHoje / 2;
  const metadeHonorarioFuturo = totalHonorariosFuturo / 2;


  const toUpper = (texto: string): string => {
    return texto.toUpperCase();
  };

  const formatarNumeroProcesso = (valor: string) => {
    let v = valor.replace(/\D/g, "").slice(0, 20);
    if (v.length >= 7) v = `${v.slice(0, 7)}-${v.slice(7)}`;
    if (v.length >= 10) v = `${v.slice(0, 10)}.${v.slice(10)}`;
    if (v.length >= 15) v = `${v.slice(0, 15)}.${v.slice(15)}`;
    if (v.length >= 17) v = `${v.slice(0, 17)}.${v.slice(17)}`;
    if (v.length >= 20) v = `${v.slice(0, 20)}`;
    return v;
  };


  return (
<main className="w-full max-w-7xl mx-auto p-4 space-y-6">
{typeof window !== "undefined" && (
  (() => {
    const nomeAdvogado = localStorage.getItem("nomeAdvogado");
    const oabAdvogado = localStorage.getItem("oabAdvogado");
    const nomeUsuario = localStorage.getItem("nomeUsuario");

    const nomeExibido = nomeAdvogado || nomeUsuario;
    const oabExibida = nomeAdvogado ? ` – OAB ${oabAdvogado}` : "";

    if (!nomeExibido) return null;

    return (
      <div className="relative mb-6 px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-xl shadow flex items-center justify-between text-sm font-medium text-gray-800 tracking-tight">
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">👤</span>
          <span>
            <strong className="text-gray-900">{nomeExibido}</strong>
            <span className="text-gray-500">{oabExibida}</span>
          </span>
        </div>
        <button
          onClick={() => {
            localStorage.clear(); // Limpa tudo
            window.location.href = "/login";
          }}
          className="px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 border border-red-300 rounded-md transition-all duration-200 text-xs font-semibold shadow-sm"
        >
          Sair
        </button>
      </div>
    );
  })()
)}
  
  <h1 className="text-2xl font-bold">Extrato de Consórcio</h1>

  <div className="flex flex-col lg:flex-row gap-4">

    {/* BLOCO 1 - Upload do PDF */}
    <section className="bg-white shadow p-4 rounded-lg space-y-4 w-full lg:w-1/3">
      <h2 className="font-semibold text-lg">1. Enviar PDF do Extrato</h2>
      <div className="flex items-center gap-4">
        <label className="flex items-center justify-center bg-gray-100 border border-gray-300 text-gray-700 px-4 py-2 rounded cursor-pointer hover:bg-gray-200 transition">
          Escolher Arquivo
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
        {arquivo && <span className="text-sm text-gray-600 truncate max-w-xs">{arquivo.name}</span>}
      </div>
      <button
        onClick={enviarPDF}
        className="bg-blue-600 text-white px-3 py-2 rounded w-full hover:bg-blue-700 transition"
        disabled={!arquivo}
      >
        Enviar e Processar PDF
      </button>
      {mensagem && (
        <div className="text-center text-green-700 font-medium mt-2">{mensagem}</div>
        )}
      {etapa === "analise" && (
        <>
{/* COLUNA DE AÇÕES */}
<div className="w-full mt-10">

  {/* 🔽 Divisão visual acima dos botões */}
  <div className="border-t border-gray-300 pt-6 mt-6">
    <div className="bg-gray-50 border border-gray-300 rounded-xl shadow-md p-5 flex flex-col gap-4 items-center md:items-end">

      <h3 className="text-lg font-semibold text-gray-700 w-full text-left">
        ⚙️ Ações
      </h3>

      {/* Botão Editar Extrato */}
      <button
        className="bg-gray-600 text-white px-6 py-2 rounded shadow hover:bg-gray-700 w-full md:w-[320px]"
        onClick={() => setEtapa("ajuste")}
      >
        ✏️ Editar Extrato
      </button>

      {/* Escolher Advogado */}
      {localStorage.getItem("perfilUsuario") === "admin" && (
        <div className="w-full md:w-[320px]">
          <label className="block font-medium mb-1 text-yellow-900">👤 Escolher Advogado</label>
          <select
            className="border p-2 rounded w-full"
            value={advogadoSelecionado}
            onChange={(e) => setAdvogadoSelecionado(e.target.value)}
          >
            <option value="">Selecione um advogado</option>
            {advogados.map((adv) => (
              <option key={adv.usuario} value={adv.usuario}>
                {adv.nome_completo} ({adv.oab})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Botão Gerar Documentos */}
<button
  onClick={() => {
    const errosEstado = camposObrigatoriosFaltando(dadosBasicos, dadosManuais, parcelas);
    const errosDOM = verificarCamposObrigatoriosDOM();

    const erros = [...errosEstado, ...errosDOM];

    // 🔒 Verifica se é admin e advogado não foi selecionado
    const perfil = localStorage.getItem("perfilUsuario");
    if (perfil === "admin" && !advogadoSelecionado) {
      alert("⚠️ Por favor, selecione um advogado antes de gerar os documentos.");
      return;
    }

    if (erros.length > 0) {
      alert("⚠️ Os seguintes campos estão incompletos:\n\n- " + erros.join("\n- "));
      return;
    }

    gerarDocumentosWord();
  }}
  className="bg-blue-600 text-white py-3 px-6 rounded shadow hover:bg-blue-700 w-full md:w-[320px] text-center"
>
  📄 Gerar Procuração/Contrato
</button>
    </div>
  </div>
</div>

          
        </>
      )}
      </section>

{/* BLOCO 2 - Valores Corrigidos + Índices */}
<div className="bg-blue-50 shadow p-4 border border-blue-300 rounded-lg w-full lg:w-1/3 flex flex-col justify-between">
  <div>
    <h2 className="text-blue-800 font-semibold mb-2">💰 Valores Corrigidos</h2>
    <button
      className="w-full py-2 mb-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
      onClick={calcularValores}
      type="button"
    >
      Calcular valores
    </button>

    <div className="text-sm text-gray-800 space-y-1">
      {/* Valor Corrigido Hoje */}
      <p>
        <strong>✔️ Valor Corrigido Hoje:</strong>{" "}
        {formatarReais(
          dadosManuais.fase_processo === "Perdemos"
            ? 0
            : houveAcordo
            ? parseFloat(valorAcordo || "0")
            : houveSentenca && tipoSentenca === "avista"
            ? parseFloat(valorSentenca || "0")
            : resultadoJurosHoje || 0
        )}
      </p>

      {/* Valor Corrigido Futuro */}
      <p>
        <strong>✔️ Valor Corrigido Futuro:</strong>{" "}
        {formatarReais(
          dadosManuais.fase_processo === "Perdemos"
            ? 0
            : houveAcordo || (houveSentenca && tipoSentenca === "avista")
            ? 0
            : resultadoJurosFuturo || 0
        )}
      </p>

      {/* Reembolso de Custas (substitui a linha "custas" quando ganhamos) */}
      {dadosManuais.fase_processo === "Ganhamos" && totalCustasProcessuais > 0 && (
        <p className="text-green-600 font-medium">
          🔁 Reembolso de Custas: {formatarReais(totalCustasProcessuais)}
        </p>
      )}

      {/* Honorários */}
      <p>
        <strong>(-) Honorários:</strong><br />
        Hoje: {formatarReais(dadosManuais.fase_processo === "Perdemos" ? 0 : totalHonorariosHoje)} = {formatarReais(dadosManuais.fase_processo === "Perdemos" ? 0 : metadeHonorarioHoje)} (adv.) + {formatarReais(dadosManuais.fase_processo === "Perdemos" ? 0 : metadeHonorarioHoje)} (emp.)<br />
        Futuro: {formatarReais(dadosManuais.fase_processo === "Perdemos" ? 0 : totalHonorariosFuturo)} = {formatarReais(dadosManuais.fase_processo === "Perdemos" ? 0 : metadeHonorarioFuturo)} (adv.) + {formatarReais(dadosManuais.fase_processo === "Perdemos" ? 0 : metadeHonorarioFuturo)} (emp.)
      </p>

      {/* Custas Processuais (exibe somente se não ganhou) */}
      {dadosManuais.fase_processo !== "Ganhamos" && (
        <p>
          <strong>(-) Custas Processuais:</strong> {formatarReais(totalCustasProcessuais)}
        </p>
      )}

      {/* Ganho ou Perda com Sucumbência */}
      {dadosManuais.fase_processo === "Ganhamos" && (
        <p className="text-green-700">
          (+) Ganho com Sucumbência: {formatarReais(parseFloat(dadosManuais.ganho_sucumbencia || "0"))}
        </p>
      )}
      {dadosManuais.fase_processo === "Perdemos" && (
        <p className="text-red-700">
          (-) Perda com Sucumbência: {formatarReais(parseFloat(dadosManuais.perda_sucumbencia || "0"))}
        </p>
      )}

      <hr className="my-2" />

      {/* Líquido Hoje */}
      <p className={`${dadosManuais.fase_processo === "Perdemos" ? "text-red-700" : "text-green-700"} font-bold`}>
        {dadosManuais.fase_processo === "Perdemos" ? "❌ Prejuízo: " : "✅ Líquido Hoje: "}
        {
          formatarReais(
            dadosManuais.fase_processo === "Perdemos"
              ? (
                  totalCustasProcessuais +
                  parseFloat(dadosManuais.perda_sucumbencia || "0")
                ) * -1
              : valorBaseHoje
                  - totalHonorariosHoje
                  - parseFloat(dadosManuais.taxa_administracao_deduzida || "0")
                  - parseFloat(dadosManuais.valor_outros_custos || "0")
                  + (dadosManuais.fase_processo === "Ganhamos" ? totalCustasProcessuais : 0)
                  + (dadosManuais.fase_processo === "Ganhamos"
                      ? parseFloat(dadosManuais.ganho_sucumbencia || "0")
                      : 0)
          )
        }
      </p>


      {/* Líquido Futuro */}
      {!(houveAcordo || (houveSentenca && tipoSentenca === "avista") || dadosManuais.fase_processo === "Perdemos") && (
        <p className="text-green-700 font-bold">✅ Líquido Futuro: {
          formatarReais(
            valorBaseFuturo
            - totalHonorariosFuturo
            - parseFloat(dadosManuais.taxa_administracao_deduzida || "0")
            - parseFloat(dadosManuais.valor_outros_custos || "0")
            + (dadosManuais.fase_processo === "Ganhamos" ? totalCustasProcessuais : -totalCustasProcessuais)
            + (dadosManuais.fase_processo === "Ganhamos"
                ? parseFloat(dadosManuais.ganho_sucumbencia || "0")
                : 0)
          )
        }</p>
      )}
    </div>
  </div>

  {/* Seleção dos Índices */}
  <div className="mt-4 text-sm text-gray-700 space-y-2">
    <div>
      <label className="block font-medium">Índice - até hoje</label>
      <select
        value={dadosManuais.indice_corrigido_hoje}
        onChange={(e) =>
          setDadosManuais((prev) => ({
            ...prev,
            indice_corrigido_hoje: e.target.value,
          }))
        }
        className="w-full border border-gray-300 rounded p-1"
      >
        <option value="TJMG">TJMG</option>
        <option value="IPCA">IPCA</option>
        <option value="INPC">INPC</option>
      </select>
    </div>

    <div>
      <label className="block font-medium">Índice - até o futuro</label>
      <select
        value={dadosManuais.indice_corrigido_futuro}
        onChange={(e) =>
          setDadosManuais((prev) => ({
            ...prev,
            indice_corrigido_futuro: e.target.value,
          }))
        }
        className="w-full border border-gray-300 rounded p-1"
      >
        <option value="TJMG">TJMG</option>
        <option value="IPCA">IPCA</option>
        <option value="INPC">INPC</option>
      </select>
    </div>
  </div>
</div>

    <div className={`p-4 rounded-xl shadow-sm w-full lg:w-1/3 transition-colors
      ${dadosManuais.fase_processo === "Ganhamos" || dadosManuais.fase_processo === "Acordo"
        ? "bg-green-100 border border-green-300"
        : dadosManuais.fase_processo === "Perdemos"
        ? "bg-red-100 border border-red-300"
        : "bg-gray-100 border border-gray-300"}
    `}>
  <h2 className="font-bold text-gray-800 text-lg mb-4">📌 Resultado do Processo</h2>

  <div className="mb-4">
    <label className="block font-medium mb-1">Resultado do Processo</label>
    <select
      value={dadosManuais.fase_processo || "Sem Julgamento"}
      onChange={(e) => {
        const fase = e.target.value;
        setDadosManuais({ ...dadosManuais, fase_processo: fase });

        if (fase === "Ganhamos") {
          setHouveSentenca(true);
          setHouveAcordo(false);
        } else if (fase === "Acordo") {
          setHouveAcordo(true);
          setHouveSentenca(false);
        } else {
          setHouveAcordo(false);
          setHouveSentenca(false);
        }
      }}
      className="border rounded w-full p-2 bg-white"
    >
      <option value="Sem Julgamento">Sem Julgamento</option>
      <option value="Acordo">Acordo</option>
      <option value="Ganhamos">Ganhamos</option>
      <option value="Perdemos">Perdemos</option>
    </select>
  </div>

  {/* Acordo */}
  {dadosManuais.fase_processo === "Acordo" && (
    <div className="mb-4">
      <label className="block font-medium">Valor do Acordo</label>
      <NumericFormat
        value={valorAcordo}
        onValueChange={(val) => setValorAcordo(val.value)}
        prefix="R$ "
        thousandSeparator="."
        decimalSeparator=","
        className="border rounded px-3 py-1 w-full"
        allowNegative={false}
      />
    </div>
  )}

  {/* Ganhamos */}
  {dadosManuais.fase_processo === "Ganhamos" && (
    <>
      <div className="mb-4">
        <label className="block font-medium mb-1">Tipo de Pagamento</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={tipoSentenca === "avista"}
              onChange={() => setTipoSentenca("avista")}
            />
            À Vista
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={tipoSentenca === "futuro"}
              onChange={() => setTipoSentenca("futuro")}
            />
            Futuro
          </label>
        </div>
      </div>

      {tipoSentenca === "avista" && (
        <div className="mb-4">
          <label className="block font-medium">Valor da Sentença (à vista)</label>
          <NumericFormat
            value={valorSentenca}
            onValueChange={(val) => setValorSentenca(val.value)}
            prefix="R$ "
            thousandSeparator="."
            decimalSeparator=","
            className="border rounded px-3 py-1 w-full"
            allowNegative={false}
          />
        </div>
      )}

        <div className="mb-4">
          <label className="block font-medium text-yellow-800">💰 Ganho com Sucumbência (R$)</label>
          <NumericFormat
            value={dadosManuais.ganho_sucumbencia || ""}
            onValueChange={(val) =>
              setDadosManuais({
                ...dadosManuais,
                ganho_sucumbencia: val.value, // apenas número puro, ex: 1000.50
              })
            }
            thousandSeparator="."
            decimalSeparator=","
            prefix="R$ "
            allowNegative={false}
            placeholder="R$ 0,00"
            className="border border-yellow-400 p-2 rounded w-full text-right bg-white"
          />
        </div>
    </>
  )}

  {/* Perdemos */}
  {dadosManuais.fase_processo === "Perdemos" && (
    <>
      <div className="mb-4">
        <label className="block font-medium text-red-800">💸 Perda com Sucumbência (R$)</label>
        <NumericFormat
          value={dadosManuais.perda_sucumbencia || ""}
          onValueChange={(val) =>
            setDadosManuais({
              ...dadosManuais,
              perda_sucumbencia: val.value, // número puro sem máscara
            })
          }
          thousandSeparator="."
          decimalSeparator=","
          prefix="R$ "
          allowNegative={false}
          placeholder="R$ 0,00"
          className="border border-red-400 p-2 rounded w-full text-right bg-white"
        />
      </div>

      <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-800 mb-3">
        Processo Perdido com sentença desfavorável.
      </div>

      {dadosManuais.tipo_justica === "Justiça Comum" ? (
        <div className="mb-4">
          <label className="block font-medium text-red-600">💼 Valor de Custas a Pagar</label>
          <input
            type="text"
            inputMode="decimal"
            className="border border-red-300 p-2 rounded w-full text-right bg-white"
            placeholder="0,00"
          />
        </div>
      ) : (
        <div className="text-gray-700 text-sm mb-4">Juizado Especial: não há custas.</div>
      )}
    </>
  )}
</div>
    </div>

{etapa === "analise" && (
  <section className="bg-white shadow p-4 rounded-lg space-y-4">
    <div className="w-full max-w-7xl mx-auto px-4">
      <div className="w-full bg-blue-50 border border-blue-300 rounded-lg p-4 shadow space-y-6 text-xs text-gray-800">

<h2 className="text-blue-800 font-semibold text-lg">📝 Análise Completa</h2>

{/* 📄 DADOS DO CONSORCIADO */}
<div>
  <h3 className="text-gray-700 font-semibold text-sm mb-2">📄 Dados do Consorciado</h3>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

    {/* Nome */}
    <div className="md:col-span-3">
      <label className="block font-semibold">🙍 Nome</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.nome_cliente}
        onChange={(e) =>
          setDadosBasicos({ ...dadosBasicos, nome_cliente: e.target.value })
        }
      />
    </div>

    {/* Nacionalidade */}
    <div>
      <label className="block text-sm font-medium text-gray-700">🌎 Nacionalidade</label>
      <select
        data-obrigatorio
        className="border p-1 rounded w-full text-sm"
        value={dadosBasicos.nacionalidade || ""}
        onChange={(e) =>
          setDadosBasicos({ ...dadosBasicos, nacionalidade: e.target.value })
        }
      >
        <option value="">Selecione</option>
        <option value="Brasileiro">Brasileiro</option>
        <option value="Brasileira">Brasileira</option>
        <option value="Brasileiro Trans">Brasileiro Trans</option>
        <option value="Brasileira Trans">Brasileira Trans</option>
        <option value="Não-binário">Não-binário</option>
        <option value="Outro">Outro</option>
      </select>
    </div>

    {/* CPF/CNPJ */}
    <div>
      <label htmlFor="cpf_cnpj" className="block font-semibold mb-1">🆔 CPF/CNPJ</label>
      <input
        data-obrigatorio
        type="text"
        id="cpf_cnpj"
        className="border p-1 rounded w-full"
        value={dadosBasicos.cpf_cnpj}
        onChange={(e) =>
          setDadosBasicos({
            ...dadosBasicos,
            cpf_cnpj: aplicarMascara("cpf_cnpj", e.target.value),
          })
        }
        placeholder="000.000.000-00 ou 00.000.000/0000-00"
      />
    </div>

    {/* Tipo Documento */}
    <div>
      <label>📑 Tipo Documento</label>
      <select
        data-obrigatorio
        className="border p-1 rounded w-full"
        value={dadosBasicos.tipo_documento}
        onChange={(e) =>
          setDadosBasicos({ ...dadosBasicos, tipo_documento: e.target.value })
        }
      >
        <option value="">Selecione</option>
        <option value="CPF">CPF</option>
        <option value="CNPJ">CNPJ</option>
      </select>
    </div>

    {/* Endereço - Rua */}
    <div className="md:col-span-2">
      <label>🏠 Rua</label>
    <input
      data-obrigatorio
      type="text"
      className="border p-1 rounded w-full"
      value={dadosBasicos.rua}
      onChange={(e) => setDadosBasicos({ ...dadosBasicos, rua: e.target.value })}
    />
    </div>

    {/* Endereço - Número */}
    <div>
      <label>🔢 Número</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.numero || ""}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, numero: e.target.value })}
      />
    </div>
        {/* Complemento */}
    <div className="md:col-span-2">
      <label>🏢 Complemento</label>
      <input
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.complemento || ""}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, complemento: e.target.value })}
      />
    </div>
    {/* Bairro */}
    <div>
      <label>🏘️ Bairro</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.bairro}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, bairro: e.target.value })}
      />
    </div>

    {/* Cidade */}
    <div>
      <label>🏙️ Cidade</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.cidade}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, cidade: e.target.value })}
      />
    </div>

    {/* Estado */}
    <div>
      <label>🌎 Estado</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.estado}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, estado: e.target.value })}
      />
    </div>

    {/* CEP */}
    <div>
      <label htmlFor="cep" className="block font-semibold mb-1">📮 CEP</label>
      <input
        data-obrigatorio
        type="text"
        id="cep"
        className="border p-1 rounded w-full"
        value={dadosBasicos.cep}
        onChange={(e) => {
          const cepMascarado = aplicarMascara("cep", e.target.value);
          setDadosBasicos({ ...dadosBasicos, cep: cepMascarado });

          if (cepMascarado.replace(/\D/g, "").length === 8) {
            fetch(`https://viacep.com.br/ws/${cepMascarado.replace(/\D/g, "")}/json/`)
              .then((res) => res.json())
              .then((data) => {
                if (!data.erro) {
                  setDadosBasicos((prev) => ({
                    ...prev,
                    rua: data.logradouro || prev.rua,
                    bairro: data.bairro || prev.bairro,
                    cidade: data.localidade || prev.cidade,
                    estado: data.uf || prev.estado,
                  }));
                }
              })
              .catch((error) => {
                console.error("Erro ao buscar CEP:", error);
              });
          }
        }}
        placeholder="00000-000"
      />
    </div>

  {/* Telefone do cliente */}
    <div>
      <label>📞 Telefone do cliente *</label>
      <PatternFormat
        format="(##) #####-####"
        mask="_"
        value={dadosManuais.telefone}
        onValueChange={(val) =>
          setDadosManuais((prev) => ({
            ...prev,
            telefone: val.value,
          }))
        }
        className={`border p-1 rounded w-full ${
          dadosManuais.telefone?.replace(/\D/g, "").length === 11
            ? ""
            : "border-red-500 focus:border-red-500 focus:ring-red-500"
        }`}
        placeholder="(31) 91234-5678"
        data-obrigatorio
      />
    </div>
    <div>
      <label>📧 E-mail do cliente</label>
      <input
        type="email"
        value={emailCliente}
        onChange={(e) => {
          setEmailCliente(e.target.value);
          setEmailInvalido(false);
        }}
        onBlur={() => {
          if (emailClienteHabilitado) {
            const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCliente);
            setEmailInvalido(!valido);
          }
        }}
        className={`border p-1 rounded w-full ${
          emailClienteHabilitado && (emailInvalido || emailCliente === "")
            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
            : ""
        }`}
        placeholder="cliente@email.com"
        disabled={!emailClienteHabilitado}
        {...(emailClienteHabilitado ? { "data-obrigatorio": true } : {})}
      />
    </div>
    
    {/* Nº Contrato */}
    <div>
      <label>🧾 Nº Contrato</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.numero_contrato}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, numero_contrato: e.target.value })}
      />
    </div>
      {/* Grupo */}
    <div>
      <label>📌 Grupo</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.grupo}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, grupo: e.target.value })}
      />
    </div>

    {/* Cota */}
    <div>
      <label>📌 Cota</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.cota}
        onChange={(e) => setDadosBasicos({ ...dadosBasicos, cota: e.target.value })}
      />
    </div>

    {/* Administradora */}
    <div className="md:col-span-2">
      <label>🏢 Administradora</label>
      <input
        data-obrigatorio
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.administradora}
        onChange={(e) =>
          setDadosBasicos({ ...dadosBasicos, administradora: e.target.value })
        }
      />
    </div>

    {/* CNPJ da Administradora */}
    <div>
      <label>🔢 CNPJ da Administradora</label>
      <input
        type="text"
        className="border p-1 rounded w-full"
        value={dadosBasicos.cnpj_administradora}
        onChange={(e) =>
          setDadosBasicos((prev) => ({
            ...prev,
            cnpj_administradora: e.target.value,
          }))
        }
      />
    </div>
  </div>
</div>


{/* 💰 INFORMAÇÕES FINANCEIRAS */}
<div className="mt-6">
  <h3 className="text-gray-700 font-semibold text-sm mb-1">💰 Informações Financeiras</h3>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

    {/* Total Parcelas Plano */}
    <div>
      <label>📅 Total Parcelas Plano</label>
      <input
        data-obrigatorio
        type="number"
        className="border p-1 rounded w-full"
        value={dadosBasicos.total_parcelas_plano}
        onChange={(e) =>
          setDadosBasicos({ ...dadosBasicos, total_parcelas_plano: Number(e.target.value) })
        }
      />
    </div>

    {/* Parcelas Pagas */}
    <div>
      <label>📦 Parcelas Pagas</label>
      <input
        data-obrigatorio
        type="number"
        disabled
        className="border p-1 rounded w-full bg-gray-100"
        value={parcelasRealmentePagas}
      />
    </div>

    {/* Data de Encerramento */}
    <div>
      <label>📆 Encerramento</label>
      <input
        data-obrigatorio
        type="date" // mantém assim
        className="border p-1 rounded w-full"
        value={converterParaInputDate(dadosBasicos.data_encerramento)} // converte para ISO para input
        onChange={(e) =>
          setDadosBasicos({ ...dadosBasicos, data_encerramento: e.target.value }) // mantém ISO no estado
        }
      />
    </div>

    {/* Valor Pago Extrato */}
    <div>
      <label>💰 Valor Pago Extrato</label>
      <input
        data-obrigatorio
        type="text"
        inputMode="numeric"
        className="border p-1 rounded w-full"
        value={formatarReais(dadosBasicos.valor_total_pago_extrato)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          const valor = parseFloat(raw) / 100;
          setDadosBasicos({ ...dadosBasicos, valor_total_pago_extrato: isNaN(valor) ? 0 : valor });
        }}
      />
    </div>

    {/* Valor do Crédito */}
    <div>
      <label>💳 Valor do Crédito</label>
      <input
        type="text"
        inputMode="numeric"
        className="border p-1 rounded w-full"
        value={formatarReais(dadosBasicos.valor_credito || 0)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          const valor = parseFloat(raw) / 100;
          setDadosBasicos({ ...dadosBasicos, valor_credito: isNaN(valor) ? 0 : valor });
        }}
      />
    </div>

    {/* Soma Pagamentos */}
    <div>
      <label>➕ Soma Pagamentos</label>
      <input
        data-obrigatorio
        type="text"
        disabled
        className="border p-1 rounded w-full bg-gray-100"
        value={formatarReais(soma)}
      />
    </div>

    {/* Diferença */}
    <div>
      <label>🔻 Diferença</label>
      <input
        data-obrigatorio
        type="text"
        disabled
        className={`border p-1 rounded w-full bg-gray-100 ${diferenca !== 0 ? "text-red-600 font-bold" : ""}`}
        value={formatarReais(diferenca)}
      />
    </div>

    {/* Taxa Adm. Contratada (%) */}
    <div>
      <label>📉 Taxa Adm. Contratada (%)</label>
      <input
        data-obrigatorio
        type="number"
        step="0.0001"
        className="border p-1 rounded w-full"
        value={dadosBasicos.taxa_adm_percentual || ""}
        onChange={(e) => {
          const valor = parseFloat(e.target.value.replace(",", "."));
          setDadosBasicos({ ...dadosBasicos, taxa_adm_percentual: isNaN(valor) ? 0 : valor });
        }}
      />
    </div>

    {/* Taxa Adm. Devida (%) */}
    <div>
      <label>✅ Taxa Adm. Devida (%)</label>
      <input
        data-obrigatorio
        type="text"
        disabled
        className="border p-1 rounded w-full bg-gray-100"
        value={
          typeof resultadoTaxaAdmDevidaPercentual === "number"
            ? `${resultadoTaxaAdmDevidaPercentual.toFixed(4)}%`
            : "0.0000%"
        }
      />
    </div>

    {/* Valor Total Taxa Adm. Cobrada */}
    <div>
      <label>💸 Valor Total Taxa Adm. Cobrada</label>
      <input
        data-obrigatorio
        type="text"
        disabled
        className="border p-1 rounded w-full bg-gray-100 font-semibold"
        value={formatarReais(dadosBasicos.taxa_adm_cobrada_valor || 0)}
      />
    </div>

    {/* Percentual Cobrada (calculado) */}
    <div>
      <label>📊 Percentual Cobrada (calculado)</label>
      <input
        data-obrigatorio
        type="text"
        disabled
        className="border p-1 rounded w-full bg-gray-100"
        value={
          dadosBasicos.taxa_adm_cobrada_valor && dadosBasicos.valor_total_pago_extrato
            ? `${(
                (dadosBasicos.taxa_adm_cobrada_valor / dadosBasicos.valor_total_pago_extrato) * 100
              ).toFixed(4)}%`
            : "0.0000%"
        }
      />
    </div>

    {/* Valor Taxa Adm. Devida (R$) */}
    <div>
      <label>✅ Valor Taxa Adm. Devida (R$)</label>
      <input
        data-obrigatorio
        type="text"
        disabled
        className="border p-1 rounded w-full bg-gray-100"
        value={formatarReais(resultadoTaxaAdmDevidaValor ?? 0)}
      />
    </div>
  </div>
</div>

<div className="mt-6">
  <h2 className="text-md font-semibold text-gray-700 mb-2">📌 Selecione o valor da causa</h2>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

    {/* ✅ Valor pg. (-) Tx. Adm. */}
    <div
      className={`rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md p-4 border shadow-sm ${valorSelecionado === 'valor_pg_tx' ? 'bg-blue-200 border-blue-500' : 'bg-blue-100 border-blue-300'}`}
      onClick={() => setValorSelecionado('valor_pg_tx')}
    >
      <label className="text-sm font-medium text-gray-600 block mb-1">
        ✅ Valor pg. (-) Tx. Adm. Devida (R$)
      </label>
      <p className="text-xl font-bold text-blue-800">
        R$ {formatarReais(dadosBasicos.valor_total_pago_extrato - (resultadoTaxaAdmDevidaValor ?? 0))}
      </p>
      {valorSelecionado === 'valor_pg_tx' && (
        <p className="text-xs mt-1 text-blue-900">Valor da causa selecionado</p>
      )}
    </div>

    {/* 💳 Valor do Crédito */}
    <div
      className={`rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md p-4 border shadow-sm ${valorSelecionado === 'valor_credito' ? 'bg-blue-200 border-blue-500' : 'bg-blue-100 border-blue-300'}`}
      onClick={() => setValorSelecionado('valor_credito')}
    >
      <label className="text-sm font-medium text-gray-600 block mb-1">
        💳 Valor do Crédito (R$)
      </label>
      <p className="text-xl font-bold text-blue-800">
        R$ {formatarReais(dadosBasicos.valor_credito || 0)}
      </p>
      {valorSelecionado === 'valor_credito' && (
        <p className="text-xs mt-1 text-blue-900">Valor da causa selecionado</p>
      )}
    </div>

    {/* 💵 Valor Pago no Extrato */}
    <div
      className={`rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md p-4 border shadow-sm ${valorSelecionado === 'valor_pago_extrato' ? 'bg-blue-200 border-blue-500' : 'bg-blue-100 border-blue-300'}`}
      onClick={() => setValorSelecionado('valor_pago_extrato')}
    >
      <label className="text-sm font-medium text-gray-600 block mb-1">
        💵 Valor Pago no Extrato (R$)
      </label>
      <p className="text-xl font-bold text-blue-800">
        R$ {formatarReais(dadosBasicos.valor_total_pago_extrato)}
      </p>
      {valorSelecionado === 'valor_pago_extrato' && (
        <p className="text-xs mt-1 text-blue-900">Valor da causa selecionado</p>
      )}
    </div>
  </div>
</div>

{/* Valores Adicionais Detectados */}
<div className="col-span-full mt-4">
  <h4 className="text-gray-700 font-semibold text-sm mb-1">📌 Valores Adicionais Detectados</h4>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

    {/* Fundo Comum */}
  <div>
    <label>💼 Fundo Comum</label>
    <NumericFormat
      className="border p-1 rounded w-full" // Sem bg-gray-100
      value={dadosBasicos.fundo_comum ?? ""}
      thousandSeparator="."
      decimalSeparator=","
      prefix="R$ "
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      onValueChange={(val) =>
        setDadosBasicos({ ...dadosBasicos, fundo_comum: val.floatValue ?? 0 })
      }
    />
  </div>


    <div>
      <label>🏦 Fundo de Reserva</label>
      <NumericFormat
        className="border p-1 rounded w-full"
        value={dadosBasicos.fundo_reserva ?? ""}
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        onValueChange={(val) =>
          setDadosBasicos({ ...dadosBasicos, fundo_reserva: val.floatValue ?? 0 })
        }
      />
    </div>

{/* Seguros */}
<div>
  <label>🛡️ Seguros</label>
  <NumericFormat
    className="border p-1 rounded w-full"
    value={dadosBasicos.seguros ?? ""}
    thousandSeparator="."
    decimalSeparator=","
    prefix="R$ "
    decimalScale={2}
    fixedDecimalScale
    allowNegative={false}
    onValueChange={(val) =>
      setDadosBasicos({ ...dadosBasicos, seguros: val.floatValue ?? 0 })
    }
  />
</div>

{/* Multas */}
<div>
  <label>⚠️ Multas</label>
  <NumericFormat
    className="border p-1 rounded w-full"
    value={dadosBasicos.multas ?? ""}
    thousandSeparator="."
    decimalSeparator=","
    prefix="R$ "
    decimalScale={2}
    fixedDecimalScale
    allowNegative={false}
    onValueChange={(val) =>
      setDadosBasicos({ ...dadosBasicos, multas: val.floatValue ?? 0 })
    }
  />
</div>

{/* Juros */}
<div>
  <label>📈 Juros</label>
  <NumericFormat
    className="border p-1 rounded w-full"
    value={dadosBasicos.juros ?? ""}
    thousandSeparator="."
    decimalSeparator=","
    prefix="R$ "
    decimalScale={2}
    fixedDecimalScale
    allowNegative={false}
    onValueChange={(val) =>
      setDadosBasicos({ ...dadosBasicos, juros: val.floatValue ?? 0 })
    }
  />
</div>

{/* Adesão */}
<div>
  <label>📝 Adesão</label>
  <NumericFormat
    className="border p-1 rounded w-full"
    value={dadosBasicos.adesao ?? ""}
    thousandSeparator="."
    decimalSeparator=","
    prefix="R$ "
    decimalScale={2}
    fixedDecimalScale
    allowNegative={false}
    onValueChange={(val) =>
      setDadosBasicos({ ...dadosBasicos, adesao: val.floatValue ?? 0 })
    }
  />
</div>

{/* Outros Valores */}
<div>
  <label>🔍 Outros Valores</label>
  <NumericFormat
    className="border p-1 rounded w-full"
    value={dadosBasicos.outros_valores ?? ""}
    thousandSeparator="."
    decimalSeparator=","
    prefix="R$ "
    decimalScale={2}
    fixedDecimalScale
    allowNegative={false}
    onValueChange={(val) =>
      setDadosBasicos({ ...dadosBasicos, outros_valores: val.floatValue ?? 0 })
    }
  />
</div>
  </div>
</div>


{/* ⚖️ DADOS DO PROCESSO */}
<div>
  <h3 className="text-gray-700 font-semibold text-sm mb-1">⚖️ Dados do Processo</h3>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    {/* Justiça Gratuita */}
    <div className="col-span-2 sm:col-span-3 md:col-span-4">
      <label className="block font-semibold">
        <input
          type="checkbox"
          className="mr-2"
          checked={dadosManuais.justica_gratuita}
          onChange={(e) =>
            setDadosManuais({ ...dadosManuais, justica_gratuita: e.target.checked })
          }
        />
        Deseja solicitar justiça gratuita?
      </label>
      
{dadosManuais.tipo_justica === "Justiça Comum" && !dadosManuais.justica_gratuita && (
  <div className="col-span-full border border-yellow-400 rounded p-3 bg-yellow-50 space-y-2">
    <h4 className="font-semibold text-yellow-800">💰 Custas Processuais</h4>

    {/* Entradas existentes */}
    {custasProcessuais.map((c, idx) => (
      <div key={idx} className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          value={c.data}
          onChange={(e) =>
            setCustasProcessuais((prev) =>
              prev.map((item, i) =>
                i === idx ? { ...item, data: e.target.value } : item
              )
            )
          }
          className="border p-1 rounded"
        />
        <NumericFormat
          value={c.valor}
          thousandSeparator="."
          decimalSeparator=","
          prefix="R$ "
          decimalScale={2}
          fixedDecimalScale
          allowNegative={false}
          onValueChange={(val) =>
            setCustasProcessuais((prev) =>
              prev.map((item, i) =>
                i === idx ? { ...item, valor: val.floatValue ?? 0 } : item
              )
            )
          }
          className="border p-1 rounded w-32"
        />
        <input
          type="text"
          placeholder="Descrição (opcional)"
          className="border p-1 rounded flex-1"
          value={c.descricao || ""}
          onChange={(e) =>
            setCustasProcessuais((prev) =>
              prev.map((item, i) =>
                i === idx ? { ...item, descricao: e.target.value } : item
              )
            )
          }
        />
        <button
          onClick={() =>
            setCustasProcessuais((prev) => prev.filter((_, i) => i !== idx))
          }
          className="text-red-600 font-bold ml-2"
        >
          ❌
        </button>
      </div>
    ))}

    {/* Botão para adicionar nova custa */}
    <button
      onClick={() =>
        setCustasProcessuais((prev) => [
          ...prev,
          { data: "", valor: 0, descricao: "" },
        ])
      }
      className="text-sm text-blue-700 hover:underline"
    >
      ➕ Adicionar Custa
    </button>
  </div>
)}

              </div>
                  {/* Tipo de Justiça */}
                  <div>
                    <label>⚖️ Tipo de Justiça</label>
                    <select
                      data-obrigatorio
                      className="border p-1 rounded w-full"
                      value={dadosManuais.tipo_justica || "Juizado Especial"}
                      onChange={(e) =>
                        setDadosManuais({ ...dadosManuais, tipo_justica: e.target.value })
                      }
                    >
                      <option value="Juizado Especial">Juizado Especial</option>
                      <option value="Justiça Comum">Justiça Comum</option>
                    </select>
                  </div>
                  <div>
                    <label>📅 Início dos Juros</label>
                    <input type="date" className="border p-1 rounded w-full" value={dadosManuais.data_inicio_juros} onChange={(e) => setDadosManuais({ ...dadosManuais, data_inicio_juros: e.target.value })} />
                  </div>
                  <div>
                    <label>📈 Taxa de Juros (%)</label>
                    <input type="number" className="border p-1 rounded w-full" value={dadosManuais.taxa_juros_percentual} onChange={(e) => setDadosManuais({ ...dadosManuais, taxa_juros_percentual: e.target.value })} />
                  </div>
                  <div>
                    <label>💼 % de Honorários</label>
                    <input 
                    data-obrigatorio
                    type="number" className="border p-1 rounded w-full" value={dadosManuais.honorarios_percentual} onChange={(e) => setDadosManuais({ ...dadosManuais, honorarios_percentual: e.target.value })} />
                  </div>
                  <div>
                    <label>📁 Nº do Processo</label>
                    <input type="text" className="border p-1 rounded w-full" value={formatarNumeroProcesso(dadosManuais.numero_processo)} onChange={(e) => setDadosManuais({ ...dadosManuais, numero_processo: e.target.value })} />
                  </div>
                  <div>
                    <label>🧑‍⚖️ Magistrado</label>
                    <input type="text" className="border p-1 rounded w-full" value={dadosManuais.magistrado} onChange={(e) => setDadosManuais({ ...dadosManuais, magistrado: e.target.value })} />
                  </div>
                </div>

                  
                 
{/* 📍 Comarcas do Cliente e da Administradora */}
<div className="col-span-full mt-6">
  <h3 className="text-sm font-semibold text-gray-800 mb-2">🏷️ Selecione a Comarca</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{/* 📍 Comarca do Cliente */}
<div
  className={`${getCorComarcaPeloTexto(
    dadosBasicos.comarca_cliente,
    comarcaSelecionada === "cliente"
  )} transition-all duration-200 hover:scale-[1.01] shadow-md p-4 rounded-xl cursor-pointer`}
  onClick={() => {
    setComarcaSelecionada("cliente");
    setDadosManuais((prev) => ({
      ...prev,
      comarca_escolhida: (dadosBasicos.comarca_cliente || "").replace(/^COMARCA DE\s+/i, "").trim(),
    }));
  }}
>
  <label className="block font-semibold text-sm text-black">🏠 Comarca do Cliente</label>
  <input
    type="text"
    className="border p-1 rounded w-full mt-1 bg-white cursor-pointer"
    value={formatarComarca(dadosBasicos.comarca_cliente) || ""}
    onChange={(e) =>
      setDadosBasicos({ ...dadosBasicos, comarca_cliente: e.target.value })
    }
    readOnly
  />
  {comarcaSelecionada === "cliente" && (
    <div className="mt-2 text-sm text-black font-medium">✅ Comarca Selecionada</div>
  )}
</div>

{/* 📍 Comarca da Administradora */}
<div
  className={`${getCorComarcaPeloTexto(
    dadosBasicos.comarca_administradora,
    comarcaSelecionada === "administradora"
  )} transition-all duration-200 hover:scale-[1.01] shadow-md p-4 rounded-xl cursor-pointer`}
  onClick={() => {
    setComarcaSelecionada("administradora");
    setDadosManuais((prev) => ({
      ...prev,
      comarca_escolhida: (dadosBasicos.comarca_administradora || "").replace(/^COMARCA DE\s+/i, "").trim(),
    }));
  }}
>
  <label className="block font-semibold text-sm text-black">🏢 Comarca da Administradora</label>
  <input
    type="text"
    className="border p-1 rounded w-full mt-1 bg-white cursor-pointer"
    value={formatarComarca(dadosBasicos.comarca_administradora) || ""}
    onChange={(e) =>
      setDadosBasicos({ ...dadosBasicos, comarca_administradora: e.target.value })
    }
    readOnly
  />
  {comarcaSelecionada === "administradora" && (
    <div className="mt-2 text-sm text-black font-medium">✅ Comarca Selecionada</div>
  )}
</div>

  </div>
</div>
</div>

                </div>
              </div>
        </section>
      )}

{/* GRID SIMPLIFICADO DE PARCELAS COM FILTRO */}
<section className="bg-white shadow p-4 rounded-lg space-y-4 w-full">
  <h3 className="font-semibold">Parcelas</h3>

  <input
    type="search"
    className="border p-2 w-full bg-gray-100 rounded"
    placeholder="Filtrar por data (ex: 2024)"
    value={filtro}
    onChange={(e) => setFiltro(e.target.value)}
  />

  <div className="overflow-x-auto">
    <table className="min-w-full text-sm border border-gray-300 rounded">
      <thead>
        <tr className="bg-gray-100 text-center">
          <th className="p-2 border border-gray-300">📅 Data de Pagamento</th>
          <th className="p-2 border border-gray-300">💵 Valor Pago</th>
          <th className="p-2 border border-gray-300">📈 Corrigido Hoje</th>
          <th className="p-2 border border-gray-300">📈 Corrigido Futuro</th>
        </tr>
      </thead>
      <tbody>
        {parcelasFiltradas.map((p, i) => (
          <tr key={i} className="text-center hover:bg-gray-50">
            <td className="border border-gray-300 px-2 py-1">
              {formatarParaBR(p.data_pagamento) || "—"}
            </td>
            <td className="border border-gray-300 px-2 py-1">
              {formatarReais(p.valor_pago)}
            </td>
            <td className="border border-gray-300 px-2 py-1">
              {formatarReais(p.valor_corrigido_hoje || 0)}
            </td>
            <td className="border border-gray-300 px-2 py-1">
              {formatarReais(p.valor_corrigido_futuro || 0)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="bg-gray-50 font-bold text-center">
          <td className="border border-gray-300 px-2 py-1 text-right">Totais:</td>
          <td className="border border-gray-300 px-2 py-1">
            {formatarReais(
              parcelasFiltradas.reduce((acc, p) => acc + (p.valor_pago || 0), 0)
            )}
          </td>
          <td className="border border-gray-300 px-2 py-1">
            {formatarReais(
              parcelasFiltradas.reduce((acc, p) => acc + (p.valor_corrigido_hoje || 0), 0)
            )}
          </td>
          <td className="border border-gray-300 px-2 py-1">
            {formatarReais(
              parcelasFiltradas.reduce((acc, p) => acc + (p.valor_corrigido_futuro || 0), 0)
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</section>

        {etapa === "ajuste" && (
          <section className="bg-white shadow p-4 rounded-lg space-y-4">
            <h2 className="font-semibold text-lg">3. Ajustar Parcelas</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">📆 Data</th>
                  <th className="text-left py-1">💵 Valor</th>
                  <th className="text-left py-1">Tipo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parcelas.map((p, index) => (
                  <tr key={index} className="border-b">
                    <td>
                      <input
                        type="date"
                        className="w-full border px-2 py-1 rounded"
                        value={converterParaInputDate(p.data_pagamento)}
                        onChange={(e) => {
                          const novaData = normalizarData(e.target.value); // "DD/MM/AAAA"
                          alterarParcela(index, "data_pagamento", novaData); // já salva formatado
                        }}
                      />
                    </td>
                    <td>
                      <NumericFormat
                        className="w-full border px-2 py-1 rounded text-right"
                        value={p.valor_pago}
                        thousandSeparator="."
                        decimalSeparator=","
                        prefix="R$ "
                        decimalScale={2}
                        fixedDecimalScale
                        allowNegative={false}
                        onValueChange={(val) =>
                          alterarParcela(index, "valor_pago", val.floatValue?.toString() || "0")
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="w-full"
                        value={p.tipo || "parcela"}
                        onChange={(e) => alterarParcela(index, "tipo", e.target.value)}
                      >
                        <option value="parcela">Parcela</option>
                        <option value="ajuste">Ajuste</option>
                      </select>
                    </td>
                    <td>
                      <button onClick={() => excluirParcela(index)} className="text-red-500">
                        ❌
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col sm:flex-row gap-2 items-center">
              <input
                type="date"
                className="border p-1 rounded w-full sm:w-auto"
                value={converterParaInputDate(novaParcela.data_pagamento)}
                onChange={(e) =>
                  setNovaParcela({
                    ...novaParcela,
                    data_pagamento: normalizarData(e.target.value), // já formatado
                  })
                }
              />
              <NumericFormat
                className="border p-1 rounded text-right w-full sm:w-auto"
                placeholder="Valor"
                value={novaParcela.valor_pago}
                thousandSeparator="."
                decimalSeparator=","
                prefix="R$ "
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                onValueChange={(val) =>
                  setNovaParcela({
                    ...novaParcela,
                    valor_pago: val.floatValue?.toString() || "0",
                  })
                }
              />
              <select
                className="border p-1 w-full sm:w-auto"
                value={novaParcela.tipo}
                onChange={(e) => setNovaParcela({ ...novaParcela, tipo: e.target.value })}
              >
                <option value="parcela">Parcela</option>
                <option value="ajuste">Ajuste</option>
              </select>
              <button className="bg-blue-600 text-white px-2 py-1 rounded" onClick={incluirParcela}>
                ➕ Incluir
              </button>
            </div>

            <button
              onClick={() => {
                calcularValores();
                setEtapa("analise");
              }}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded shadow"
            >
              ✅ Salvar e voltar para análise
            </button>
          </section>
        )}
      
      {etapa === "exportacao" && links.pdf && (
        <section className="bg-white shadow p-4 rounded-lg space-y-3">
          <h2 className="text-lg font-semibold">✅ Arquivos Gerados</h2>
          <div className="space-y-1">
            <a href={`http://localhost:8000/saida/${links.pdf}`} className="underline text-blue-600" target="_blank">📄 PDF</a><br />
            <a href={`http://localhost:8000/saida/${links.excel}`} className="underline text-blue-600" target="_blank">📊 Excel</a><br />
            <a href={`http://localhost:8000/saida/${links.json}`} className="underline text-blue-600" target="_blank">📄 JSON</a>
          </div>
          <button className="bg-gray-500 text-white px-3 py-2 rounded mt-4" onClick={novaConsulta}>
            🔄 Novo Extrato
          </button>
        </section>
      )}
          {/* Modal fica aqui no final */}
    {mostrarModal && documentosGerados && (
      <ModalDocumentos
        contratoPdf={documentosGerados.contrato_pdf}
        procuracaoPdf={documentosGerados.procuracao_pdf}
        onVoltar={() => {
          setMostrarModal(false);
          setEtapa("ajuste"); // ou etapa que quiser
        }}
        onEnviar={() => {
          alert("📤 Em breve: envio automático via ZapSign!");
        }}
      />
    )}
    </main>
  );
}