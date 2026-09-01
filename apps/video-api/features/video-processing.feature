# language: pt
Funcionalidade: Processamento de vídeos
  Como usuário da FIAP X
  Quero enviar vídeos e receber um zip com os frames
  Para reaproveitar as imagens sem precisar de ferramenta local

  Contexto:
    Dado que existe um usuário autenticado

  Cenário: Usuário envia um vídeo e recebe o zip com os frames
    Quando ele envia o vídeo "sample.mp4"
    Então o vídeo aparece com status "PENDING"
    E em até 90 segundos o status muda para "COMPLETED"
    E o download retorna um arquivo zip com pelo menos 1 frame

  Cenário: Vídeo corrompido falha e o usuário é notificado
    Quando ele envia o vídeo "corrupted.mp4"
    Então em até 90 segundos o status muda para "FAILED"
    E o motivo da falha é informado
    E um e-mail sobre "corrupted.mp4" é entregue ao usuário

  Cenário: Vários vídeos são processados ao mesmo tempo
    Quando ele envia 3 vídeos de uma vez
    Então em até 120 segundos todos os 3 vídeos estão com status "COMPLETED"

  Cenário: Formato não suportado é recusado na entrada
    Quando ele tenta enviar o arquivo "notes.pdf"
    Então a resposta é 400
