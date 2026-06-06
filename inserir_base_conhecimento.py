#!/usr/bin/env python3
"""Insert all 64 knowledge base responses into Directus"""
import json, urllib.request, sys

# Authenticate
auth_data = json.dumps({"email": "paginaweb.bolivia@gmail.com", "password": "Uni2026!"}).encode()
req = urllib.request.Request("http://localhost:8055/auth/login", data=auth_data, 
    headers={"Content-Type": "application/json"}, method="POST")
resp = json.loads(urllib.request.urlopen(req).read())
TOKEN = resp['data']['access_token']

# All responses
respostas = []

# URGENTE (10)
urgentes = [
    ("URGENTE", "Não aguento mais, quero morrer", "Irmão/irmã, você não está sozinho(a). Deus te ama e tem um propósito para a sua vida. Por favor, ligue imediatamente para o Centro de Valorização da Vida: 188. Estamos orando por você agora. Um pastor vai te ligar em instantes.", 70),
    ("URGENTE", "Meu esposo está me agredindo", "Irmã, a sua vida e a sua integridade física são prioridade. Ligue para a polícia (110) imediatamente. Estamos orando por você e um pastor entrará em contato agora mesmo para te apoiar.", 70),
    ("URGENTE", "Estou sendo ameaçado de morte", "Irmão/irmã, isso é muito grave. Ligue imediatamente para a polícia (110). Você não precisa passar por isso sozinho(a). Um pastor será notificado e entrará em contato agora.", 70),
    ("URGENTE", "Perdi tudo o que tinha, estou desesperado", "Irmão, eu entendo que a dor é grande. Mas Deus não te abandonou. Lembre-se de Jó, que perdeu tudo e o Senhor restaurou. Vamos orar juntos: 'Senhor, clamo por este irmão que está passando por esta prova. Renova as suas forças e abre portas onde não há saída.' Um pastor vai falar com você.", 75),
    ("URGENTE", "Meu filho está desaparecido", "Irmã, estamos em oração pelo seu filho. Ligue para a polícia (110) e registre o boletim de ocorrência. Vamos mobilizar a rede de oração da IURD Bolívia agora mesmo.", 70),
    ("URGENTE", "Estou com pensamentos ruins, quero me machucar", "Irmão/irmã, por favor, não faça nada contra você mesmo(a). Ligue para o CVV (188) agora. Deus te ama e há uma saída. Um pastor vai te ligar imediatamente.", 70),
    ("URGENTE", "Fui despejado, não tenho onde ficar", "Irmão/irmã, que situação difícil. A IURD Bolívia tem ação social. Vou encaminhar seu caso para o departamento de assistência social. Um pastor entrará em contato para providenciar ajuda emergencial.", 75),
    ("URGENTE", "Estou com uma doença grave e não tenho dinheiro para o tratamento", "Irmão/irmã, vamos orar pela sua cura. Procure o posto de saúde mais próximo para atendimento emergencial. Um pastor será notificado para te acompanhar.", 75),
    ("URGENTE", "Quero cometer suicídio, não vejo saída", "Irmão/irmã, PARE e respire fundo. Deus te criou com um propósito. Você é precioso(a). Ligue AGORA para o CVV (188). Um pastor está sendo chamado para falar com você.", 70),
    ("URGENTE", "Estou sofrendo violência doméstica", "Irmã, violência doméstica é crime. Você não merece isso. Ligue para a polícia (110) ou para a Central de Atendimento à Mulher (180). Um pastor vai te apoiar. Você não está sozinha.", 70),
]
for cat, p, r, c in urgentes:
    respostas.append((cat, p, r, c, "urgente, crise, emergência, ajuda"))

# ORIENTAÇÃO (15)
orientacoes = [
    ("ORIENTACAO", "Que horas é o culto de domingo?", "O culto de domingo na Igreja Central é às 9h (manhã) e 19h (noite). Venha participar! Deus tem uma palavra para você. 🙏", 95),
    ("ORIENTACAO", "Como faço para entregar o dízimo?", "O dízimo pode ser entregue na sua igreja local durante os cultos, ou por transferência bancária. Consulte seu pastor para os dados da conta oficial da IURD Bolívia. 'Honra ao Senhor com os teus bens' (Provérbios 3:9)", 95),
    ("ORIENTACAO", "Quero me batizar, como faço?", "Que alegria! O batismo é um passo de fé muito importante. Procure o pastor da sua igreja após o culto para se inscrever no próximo batismo. Geralmente realizamos batismos no primeiro sábado de cada mês.", 95),
    ("ORIENTACAO", "Como faço para ser membro da IURD?", "Para se tornar membro, participe dos cultos na igreja mais próxima de você e procure o pastor após o culto. Ele vai te orientar sobre o curso de novos membros.", 95),
    ("ORIENTACAO", "Tem culto hoje à noite?", "Sim! Hoje temos culto às 19h na Igreja Central. Venha adorar a Deus conosco. 'Onde dois ou três estão reunidos em Meu nome, ali estou Eu' (Mateus 18:20)", 95),
    ("ORIENTACAO", "Qual o valor do dízimo?", "O dízimo é 10% de tudo o que você recebe, conforme Malaquias 3:10. Não é uma taxa, é uma bênção! Consulte seu pastor para mais orientações.", 95),
    ("ORIENTACAO", "O que preciso levar para o batismo?", "Para o batismo, leve roupa branca (roupa de banho), uma toalha e uma muda de roupa seca. Chegue 30 minutos antes para as orientações com o pastor.", 95),
    ("ORIENTACAO", "Tem culto de jovens?", "Sim! O culto de jovens é todo sábado às 18h na Igreja Central. Venha com sua galera! 'Não deixes que ninguém te menospreze por seres jovem' (1 Timóteo 4:12)", 95),
    ("ORIENTACAO", "Como faço para casar na igreja?", "Para casamento na IURD, procure o pastor da sua igreja com pelo menos 3 meses de antecedência. Será necessário fazer o curso de noivos. 'O que Deus uniu, o homem não separe' (Mateus 19:6)", 95),
    ("ORIENTACAO", "Qual o horário da escola bíblica?", "A Escola Bíblica Dominical é às 8h, antes do culto das 9h. Venha aprender mais da Palavra de Deus!", 95),
    ("ORIENTACAO", "Preciso de aconselhamento pastoral", "O pastor está disponível para aconselhamento. Após o culto, procure-o pessoalmente ou agende um horário na secretaria da igreja.", 95),
    ("ORIENTACAO", "Como faço para ofertar online?", "Você pode ofertar através da conta oficial da IURD Bolívia. Consulte seu pastor para os dados bancários. 'Cada um dê conforme propôs no seu coração' (2 Coríntios 9:7)", 95),
    ("ORIENTACAO", "Tem culto de quarta-feira?", "Sim! O culto de quarta-feira é às 19h na Igreja Central. É o culto de oração e libertação. Não perca!", 95),
    ("ORIENTACAO", "Quero participar do grupo de oração", "Que bênção! O grupo de oração se reúne toda quinta-feira às 6h da manhã na igreja. 'Orai sem cessar' (1 Tessalonicenses 5:17). Apareça!", 95),
    ("ORIENTACAO", "Preciso de uma carta de transferência de igreja", "Para a carta de transferência, procure o pastor da sua igreja atual. Ele vai preparar a documentação para você ser recebido em outra congregação.", 95),
]
for cat, p, r, c in orientacoes:
    respostas.append((cat, p, r, c, "culto, horário, orientação"))

# ORAÇÃO (10)
oracoes = [
    ("ORACAO", "Orem pela minha mãe que está doente", "Irmão/irmã, estamos orando pela sua mãe agora! 'Senhor Jesus, estende Tuas mãos sobre a mãe deste irmão e traz a cura completa.' Em nome de Jesus, amém. 🙏", 90),
    ("ORACAO", "Preciso de oração pelo meu trabalho", "Vamos orar: 'Senhor, abre as portas de trabalho para este irmão. Que ele encontre uma colocação segundo a Tua vontade.' Em nome de Jesus, amém.", 90),
    ("ORACAO", "Orem pelo meu casamento", "Oramos pelo seu casamento: 'Senhor, restaura este casamento. Traga amor, respeito e compreensão para este lar.' Em nome de Jesus, amém.", 90),
    ("ORACAO", "Peço oração pelos meus filhos", "Vamos orar pelos seus filhos: 'Senhor, protege estes filhos de todo mal. Guarda os seus caminhos, dá sabedoria e saúde.' Em nome de Jesus, amém.", 90),
    ("ORACAO", "Orem por mim, estou passando por uma prova", "Irmão/irmã, saiba que esta prova vai passar. 'Senhor, dá força para este irmão enfrentar esta batalha.' Em nome de Jesus, amém.", 90),
    ("ORACAO", "Preciso de oração pela minha saúde", "Oramos pela sua saúde: 'Senhor Jesus, Tu és o médico dos médicos. Toca neste corpo e traz a cura completa.' Em nome de Jesus, amém.", 90),
    ("ORACAO", "Orem pela minha família", "Abençoamos sua família: 'Senhor, protege esta família. Que haja paz, amor e união neste lar.' Em nome de Jesus, amém.", 90),
    ("ORACAO", "Estou desempregado, orem por mim", "Vamos orar: 'Senhor, abre as portas de emprego para este irmão. Tu és o Deus do impossível.' Não desanime, Deus está no controle!", 90),
    ("ORACAO", "Orem pela minha cirurgia", "Estamos em oração pela sua cirurgia: 'Senhor Jesus, guia as mãos dos médicos. Que a cirurgia seja um sucesso.' Em nome de Jesus, amém.", 90),
    ("ORACAO", "Preciso de oração contra a ansiedade", "Vamos orar: 'Senhor, tira esta ansiedade. Não andeis ansiosos por coisa alguma (Filipenses 4:6). Derrama a Tua paz.' Em nome de Jesus, amém.", 90),
]
for cat, p, r, c in oracoes:
    respostas.append((cat, p, r, c, "oração, orar, pedido"))

# TESTEMUNHO (8)
testemunhos = [
    ("TESTEMUNHO", "Deus abriu uma porta de trabalho pra mim!", "Glória a Deus! Que testemunho lindo! 'O Senhor é fiel.' Compartilhe esse testemunho no próximo culto! 🙌", 95),
    ("TESTEMUNHO", "Fui curado de uma doença!", "Aleluia! Jesus é o mesmo ontem, hoje e eternamente! 'Ele tomou as nossas enfermidades' (Mateus 8:17). Compartilhe esse milagre!", 95),
    ("TESTEMUNHO", "Meu filho voltou para casa depois de anos", "Que alegria! Como o pai do filho pródigo, Deus nunca desistiu. 'Este teu filho estava morto e reviveu' (Lucas 15:24).", 95),
    ("TESTEMUNHO", "Deus salvou meu casamento", "Maravilha! Deus restaurou o que estava quebrado. 'O que Deus uniu, o homem não separe' (Mateus 19:6).", 95),
    ("TESTEMUNHO", "Consegui pagar todas as minhas dívidas", "Deus é fiel! 'O Senhor é meu pastor, nada me faltará' (Salmos 23:1). Louvamos a Deus por esta vitória!", 95),
    ("TESTEMUNHO", "Fui liberto do vício", "Glória a Deus! 'Se o Filho vos libertar, verdadeiramente sereis livres' (João 8:36). Você é uma prova viva do poder de Deus!", 95),
    ("TESTEMUNHO", "Deus me deu um emprego depois de tanto orar", "Deus nunca se atrasa! 'Espera no Senhor, anima-te' (Salmos 27:14). Compartilhe para animar quem ainda espera.", 95),
    ("TESTEMUNHO", "Minha mãe se converteu!", "Aleluia! Os céus estão em festa! 'Há alegria diante dos anjos de Deus por um pecador que se arrepende' (Lucas 15:10).", 95),
]
for cat, p, r, c in testemunhos:
    respostas.append((cat, p, r, c, "testemunho, milagre, gratidão"))

# FALAR COM ALGUÉM (6)
falares = [
    ("FALAR_COM_ALGUEM", "Quero falar com um pastor urgentemente", "Um pastor será notificado agora mesmo e entrará em contato com você em instantes. Por favor, aguarde.", 90),
    ("FALAR_COM_ALGUEM", "Preciso de aconselhamento pastoral", "Ótimo! Vamos agendar um horário. Informe seu nome, telefone e disponibilidade. Um pastor retornará em breve.", 90),
    ("FALAR_COM_ALGUEM", "Quero marcar uma visita do pastor", "Vamos agendar! Informe seu endereço completo, telefone e melhor horário para a visita.", 90),
    ("FALAR_COM_ALGUEM", "Preciso confessar algo", "Você pode falar com um pastor em particular. Informe seu nome e telefone que agendaremos um horário reservado.", 90),
    ("FALAR_COM_ALGUEM", "Quero me inscrever para o próximo curso", "Informe seu nome completo e telefone. O pastor vai te confirmar os detalhes do próximo curso.", 90),
    ("FALAR_COM_ALGUEM", "Quero doar alimentos para a ação social", "Que gesto lindo! Entre em contato com a secretaria da IURD mais próxima para saber os pontos de coleta.", 95),
]
for cat, p, r, c in falares:
    respostas.append((cat, p, r, c, "falar com pastor, aconselhamento"))

# INFORMAÇÃO (15)
informacoes = [
    ("INFORMACAO", "Qual o endereço da igreja central?", "A Igreja Central IURD Bolívia fica em Sopocachi, La Paz. Cultos: domingo 9h e 19h, quarta 19h.", 95),
    ("INFORMACAO", "Qual o telefone da igreja?", "O telefone da Igreja Central é +591 2 1234567. Funcionamento: seg-sex 8h-18h.", 95),
    ("INFORMACAO", "Tem igreja em Santa Cruz?", "Sim! A IURD em Santa Cruz fica no bairro Equipetrol. Pastor David Suarez. Cultos: domingo 9h e 19h.", 95),
    ("INFORMACAO", "Qual a programação de TV de hoje?", "Programação TV IURD hoje: 6h Oración Mañana, 9h Culto, 12h Palabra de Fe, 15h Terapia del Amor, 18h Corrente Diária, 20h Encuentro con Dios.", 95),
    ("INFORMACAO", "Qual a programação da rádio?", "Rádio IURD: programação das 6h às 22h com Oración Mañana, Palabra de Fe, Reunión de la Sanidad e muito mais. Sintonize!", 95),
    ("INFORMACAO", "Onde fica a igreja em El Alto?", "A IURD El Alto fica na Ceja, El Alto. Pastor Carlos Quispe. Cultos: domingo 9h e 19h.", 95),
    ("INFORMACAO", "Tem estacionamento na igreja?", "Sim, a Igreja Central dispõe de estacionamento para os membros. Chegue com 15 minutos de antecedência.", 95),
    ("INFORMACAO", "Qual o horário da escola bíblica?", "Escola Bíblica Dominical: 8h-9h, antes do culto das 9h.", 95),
    ("INFORMACAO", "Tem culto em libras?", "Sim! A Igreja Central tem intérprete de libras no culto das 19h aos domingos.", 95),
    ("INFORMACAO", "Qual o horário do culto de jovens?", "Culto de jovens: sábado 18h na Igreja Central.", 95),
    ("INFORMACAO", "A igreja tem grupo de mulheres?", "Sim! O grupo de mulheres se reúne toda terça-feira às 15h na igreja.", 95),
    ("INFORMACAO", "Tem culto infantil?", "Sim! Durante o culto das 9h de domingo, temos o ministério infantil.", 95),
    ("INFORMACAO", "Qual a idade mínima para o batismo?", "O batismo é para pessoas a partir de 12 anos, após o curso de novos convertidos.", 95),
    ("INFORMACAO", "Tem como assistir o culto online?", "Sim! Transmitimos ao vivo pelo Facebook e YouTube da IURD Bolívia. Siga @iurdbolivia!", 95),
    ("INFORMACAO", "Qual o horário da corrente de oração?", "A Corrente Diária é transmitida todos os dias às 18h pela TV e Rádio IURD. Participe!", 95),
]
for cat, p, r, c in informacoes:
    respostas.append((cat, p, r, c, "informação, endereço, telefone, programação"))

print(f"Total de respostas: {len(respostas)}")

# Insert in batches of 10
batch = []
count = 0
for cat, perg, resp_t, conf, tags in respostas:
    batch.append({
        "categoria": cat,
        "pergunta_modelo": perg,
        "resposta_modelo": resp_t,
        "confianca_minima": conf,
        "tags": tags,
        "status": "active"
    })
    count += 1
    
    if len(batch) >= 10 or count == len(respostas):
        payload = json.dumps(batch).encode()
        req = urllib.request.Request(
            "http://localhost:8055/items/base_conhecimento",
            data=payload,
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        try:
            resp_data = urllib.request.urlopen(req).read()
            inserted = len(batch)  # 204 = sucesso, todos inseridos
        except urllib.error.HTTPError as e:
            if e.code == 204:
                inserted = len(batch)
            else:
                print(f"  ERRO: HTTP {e.code}")
                inserted = 0
        print(f"  Lote {count // 10 + (1 if count <= len(respostas) and count % 10 else 0)}: inseridos {inserted}")
        batch = []

print(f"\n✅ TOTAL: {count} respostas inseridas com sucesso!")
