#!/usr/bin/env python3
"""
Geolocalizacao IURD Bolivia
===========================
Encontra a igreja IURD mais proxima de uma coordenada.
Usa formula de Haversine para calculo de distancia.

Uso:
    python3 geolocalizacao.py --lat -17.78 --lng -63.18
    python3 geolocalizacao.py --cidade "Santa Cruz"
    python3 geolocalizacao.py --test  (mostra todas as igrejas com coordenadas)
"""

import json, sys, math, urllib.request, urllib.error

DIRECTUS_URL = "http://localhost:8055"
DIRECTUS_EMAIL = "paginaweb.bolivia@gmail.com"
DIRECTUS_PASSWORD = "Uni2026!"


def haversine(lat1, lon1, lat2, lon2):
    """
    Calcula distancia entre dois pontos geograficos (Haversine).
    Retorna distancia em KM.
    """
    R = 6371  # Raio da Terra em km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_token():
    data = json.dumps({"email": DIRECTUS_EMAIL, "password": DIRECTUS_PASSWORD}).encode()
    req = urllib.request.Request(
        f"{DIRECTUS_URL}/auth/login",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())["data"]["access_token"]
    except Exception as e:
        print(f"Erro login: {e}")
        return None


def get_igrejas(token):
    req = urllib.request.Request(
        f"{DIRECTUS_URL}/items/igrejas?limit=50&filter[ativo][_eq]=1",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read()).get("data", [])
            # Filtra so quem tem coordenadas
            return [i for i in data if i.get("latitud") and i.get("longitud")]
    except Exception as e:
        print(f"Erro ao buscar igrejas: {e}")
        return []


def encontrar_mais_proxima(lat, lng, igrejas):
    """Encontra a igreja mais proxima das coordenadas fornecidas."""
    if not igrejas:
        return None
    
    melhor = None
    menor_dist = float("inf")
    
    for igreja in igrejas:
        dist = haversine(lat, lng, igreja["latitud"], igreja["longitud"])
        if dist < menor_dist:
            menor_dist = dist
            melhor = igreja
    
    return melhor, round(menor_dist, 1)


def listar_todas(igrejas):
    """Lista todas as igrejas com coordenadas."""
    print(f"\n{'ID':>3} | {'Igreja':35s} | {'Cidade':25s} | {'Lat':12s} | {'Lng':12s}")
    print("-" * 95)
    for i in igrejas:
        lat = i.get("latitud", "?")
        lng = i.get("longitud", "?")
        print(f"{i['id']:>3} | {i['nome']:35s} | {i.get('cidade',''):25s} | {str(lat):12s} | {str(lng):12s}")
    print(f"\nTotal: {len(igrejas)} igrejas com coordenadas")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Geolocalizacao IURD Bolivia")
    parser.add_argument("--lat", type=float, help="Latitude do usuario")
    parser.add_argument("--lng", type=float, help="Longitude do usuario")
    parser.add_argument("--cidade", type=str, help="Nome da cidade (busca aproximada)")
    parser.add_argument("--test", action="store_true", help="Lista todas as igrejas")
    parser.add_argument("--json", action="store_true", help="Saida em JSON")
    
    args = parser.parse_args()
    
    token = get_token()
    if not token:
        sys.exit(1)
    
    igrejas = get_igrejas(token)
    
    if args.test:
        listar_todas(igrejas)
        sys.exit(0)
    
    if args.cidade:
        # Busca igrejas na cidade
        c = args.cidade.lower()
        encontradas = [i for i in igrejas if c in i.get("cidade", "").lower()]
        if encontradas:
            igreja, dist = encontrar_mais_proxima(
                encontradas[0]["latitud"],
                encontradas[0]["longitud"],
                encontradas
            )
            if args.json:
                print(json.dumps({"igreja": igreja, "distancia_km": dist}, ensure_ascii=False))
            else:
                print(f"\n📍 Igreja mais proxima de '{args.cidade}':")
                print(f"   {igreja['nome']}")
                print(f"   {igreja.get('endereco', '')}")
                print(f"   Distancia aproximada: {dist} km")
        else:
            print(f"Nenhuma igreja encontrada em '{args.cidade}'")
        sys.exit(0)
    
    if args.lat is not None and args.lng is not None:
        igreja, dist = encontrar_mais_proxima(args.lat, args.lng, igrejas)
        if igreja:
            if args.json:
                print(json.dumps({"igreja": igreja, "distancia_km": dist}, ensure_ascii=False))
            else:
                print(f"\n📍 Igreja mais proxima:")
                print(f"   {igreja['nome']}")
                print(f"   Endereco: {igreja.get('endereco', '')}")
                print(f"   Cidade: {igreja.get('cidade', '')}")
                print(f"   Distancia: {dist} km")
                print(f"   Coordenadas: {igreja['latitud']}, {igreja['longitud']}")
        else:
            print("Nenhuma igreja encontrada com coordenadas validas")
        sys.exit(0)
    
    parser.print_help()
