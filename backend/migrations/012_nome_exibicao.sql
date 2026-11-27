-- Nome de exibicao editavel pelo usuario (inicialmente igual ao nome de cadastro)
ALTER TABLE usuarios
  ADD COLUMN nome_exibicao VARCHAR(120) NULL AFTER nome;

UPDATE usuarios SET nome_exibicao = nome WHERE nome_exibicao IS NULL;
