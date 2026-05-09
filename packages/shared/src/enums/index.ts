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
  CRIANDO_ARTE = "criando_arte",
  EM_ABERTO = "em_aberto",
  EM_PRODUCAO = "em_producao",
  AGUARDANDO_RETIRADA = "aguardando_retirada",
  EM_TRANSPORTE = "em_transporte",
  ENTREGUE = "entregue",
  AGUARDANDO_PAGAMENTO = "aguardando_pagamento",
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

export enum TipoTransacao {
  RECEITA = "receita",
  DESPESA = "despesa",
}

export enum MetodoPagamento {
  PIX = "pix",
  DINHEIRO = "dinheiro",
  CARTAO_CREDITO = "cartao_credito",
  CARTAO_DEBITO = "cartao_debito",
  BOLETO = "boleto",
  TRANSFERENCIA = "transferencia",
}

export enum StatusTransacao {
  PENDENTE = "pendente",
  PAGO = "pago",
}

export enum AmbienteFiscal {
  HOMOLOGACAO = "homologacao",
  PRODUCAO = "producao",
}

export enum RegimeTributario {
  SIMPLES_NACIONAL = "simples_nacional",
  LUCRO_PRESUMIDO = "lucro_presumido",
  LUCRO_REAL = "lucro_real",
  MEI = "mei",
}

export enum AcaoFiscal {
  EMISSAO = "emissao",
  CONSULTA = "consulta",
  CANCELAMENTO = "cancelamento",
  REPROCESSAMENTO = "reprocessamento",
}
