from openai import OpenAI
from settings import settings

client = OpenAI(api_key=settings.openai_api_key)
models = client.models.list()

for model in models:
    print(model.id)
