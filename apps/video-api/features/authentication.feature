# language: pt
Funcionalidade: Autenticação e isolamento entre usuários
  Como plataforma multiusuário
  Quero que cada pessoa veja apenas os próprios vídeos
  Para não vazar conteúdo entre contas

  Cenário: Rota protegida exige token
    Quando a lista de vídeos é consultada sem token
    Então a resposta é 401

  Cenário: Login com senha errada é recusado
    Dado que existe um usuário autenticado
    Quando ele tenta entrar com a senha errada
    Então a resposta é 401

  Cenário: Usuário não enxerga vídeo de outro usuário
    Dado que existem dois usuários autenticados
    E que o primeiro enviou um vídeo
    Quando o segundo consulta o vídeo do primeiro
    Então a resposta é 404
