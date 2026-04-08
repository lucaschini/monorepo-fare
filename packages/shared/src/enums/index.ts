export enum TipoCliente {
  PF = "PF",
  PJ = "PJ",
}

export enum TipoItem {
  PRODUTO = "produto",
  SERVICO = "servico",
}

export enum StatusOrcamento {
  RASCUNHO = "rascunho",
  ENVIADO = "enviado",
  APROVADO = "aprovado",
  RECUSADO = "recusado",
}

export enum StatusPedido {
  ABERTO = "aberto",
  EM_PRODUCAO = "em_producao",
  AGUARDANDO_MATERIAL = "aguardando_material",
  PRONTO = "pronto",
  ENTREGUE = "entregue",
  FATURADO = "faturado",
}

export enum TipoNota {
  NFE = "nfe",
  NFSE = "nfse",
}

export enum StatusNota {
  AGUARDANDO = "aguardando",
  AUTORIZADA = "autorizada",
  REJEITADA = "rejeitada",
  CANCELADA = "cancelada",
}

export enum TipoMovimentacao {
  ENTRADA = "entrada",
  SAIDA = "saida",
}
