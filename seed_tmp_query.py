import boto3
import uuid
import hashlib
import base64
import random
from decimal import Decimal

TABLE_NAME = 'tmp_query'
REGION = 'ap-southeast-4'

SPECIES = ['koala', 'kangaroo', 'wombat', 'dingo', 'magpie', 'possum', 'echidna', 'wallaby']

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)


def generate_checksum(data: str) -> str:
    raw = hashlib.sha256(data.encode()).digest()
    return base64.b64encode(raw).decode()


def random_tags() -> dict:
    chosen = random.sample(SPECIES, random.randint(1, 3))
    return {species: random.randint(1, 5) for species in chosen}


def seed(n=10):
    print(f"Seeding {n} records into {TABLE_NAME}...")

    for i in range(n):
        file_id = str(uuid.uuid4())
        file_type = random.choice(['image', 'video'])
        checksum = generate_checksum(file_id)

        # 70% complete, 30% still processing
        status = 'complete' if random.random() < 0.7 else 'processing'

        item = {
            'file_id': file_id,
            'file_type': file_type,
            'checksum': checksum,
            'status': status,
            'tags': random_tags() if status == 'complete' else {},
        }

        table.put_item(Item=item)
        print(f"  {i + 1}/10 — file_id={file_id} status={status}")

    print(f"\nDone! {n} records seeded into {TABLE_NAME}.")


if __name__ == '__main__':
    seed(10)