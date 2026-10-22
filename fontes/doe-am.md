---
id: doe-am
nome: Diário Oficial do Estado do Amazonas (DOE-AM)
publicador: Imprensa Oficial do Estado do Amazonas
url: https://diario.imprensaoficial.am.gov.br/
acesso: api
chave: nenhuma
atualizacao: diária
cobertura: Amazonas; busca de texto até 2011 e de 2017 em diante
licenca: sem licença declarada (ato oficial)
tipo: registro-oficial
confiabilidade: alta
status: verificada
verificado_em: 2026-10-22
teste: 'curl -sS -L "https://diario.imprensaoficial.am.gov.br/apifront/portal/edicoes/publicacoes_ver_conteudo/264044"'
---
- O teste devolveu em PDF a matéria do caderno Noticioso de 13/02/2026 (início do ano letivo da rede estadual).
- Busca: `/apibusca/multidiarios/busca?page=1&q=<termos>&ano=<AAAA>` (JSON). 2012–2016 não estão indexados. O id da matéria na busca não é o `identificador` de `publicacoes_ver_conteudo`; ele sai de `/portal/visualizacoes/view_html_diario/<edicao_id>`. Edição inteira: `/portal/edicoes/download/<edicao_id>`.
- O calendário escolar da rede estadual sai só como resolução do CEE/AM, sem as datas. As datas só aparecem no caderno Noticioso (notícia oficial dentro do diário).
