import asyncio
import httpx
from dotenv import load_dotenv
import os

load_dotenv('.env')

async def test():
    queries = [
        'React Developer Chennai 1+ years site:linkedin.com/in',
        'React Developer Chennai 1+ years inurl:linkedin.com/in'
    ]
    for q in queries:
        print(f'Testing query: {q}')
        async with httpx.AsyncClient() as client:
            resp = await client.post('https://google.serper.dev/search', json={'q': q, 'num': 30}, headers={'X-API-KEY': os.getenv('SERPER_API_KEY')})
            data = resp.json()
            print(data)

asyncio.run(test())
