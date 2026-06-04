import boto3
import uuid
import hashlib
import base64
import random
import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal

# Config
TABLE_NAME = 'aussie-ecolens-prod-media'
BUCKET_NAME = 'aussie-ecolens-prod-media'
REGION = 'ap-southeast-4'
USER_ID = '6659b588-0031-709b-97d4-5ef71c046ff6'

SPECIES = ['koala', 'kangaroo', 'wombat', 'dingo', 'magpie', 'possum', 'echidna', 'wallaby']

IMAGE_NAMES = [
    'koala_tree.jpg', 'kangaroo_field.jpg', 'wombat_grass.jpg',
    'dingo_desert.jpg', 'magpie_branch.jpg', 'possum_night.jpg',
    'echidna_path.jpg', 'wallaby_creek.jpg', 'wildlife_scene.jpg',
    'nature_shot.jpg', 'bush_animals.jpg', 'outback_fauna.jpg'
]

VIDEO_NAMES = [
    'kangaroo_hop.mp4', 'koala_climb.mp4', 'wildlife_footage.mp4',
    'bush_scene.mp4', 'fauna_video.mp4'
]

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)


def generate_checksum(data: str) -> str:
    """Simulate SHA-256 base64 checksum — matches team's upload convention."""
    raw = hashlib.sha256(data.encode()).digest()
    return base64.b64encode(raw).decode()


def random_tags() -> dict:
    """Generate realistic tag map with 1-3 species and random counts."""
    chosen = random.sample(SPECIES, random.randint(1, 3))
    return {species: random.randint(1, 5) for species in chosen}


def random_timestamp() -> str:
    """Random timestamp within the last 30 days."""
    now = datetime.now(timezone.utc)
    offset = timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
    return (now - offset).strftime('%Y-%m-%dT%H:%M:%SZ')


def seed(n=100):
    print(f"Seeding {n} records into {TABLE_NAME}...")

    images = 0
    videos = 0

    for i in range(n):
        file_id = str(uuid.uuid4())
        is_image = random.random() < 0.8  # 80% images, 20% videos

        if is_image:
            filename = random.choice(IMAGE_NAMES)
            file_url = f"s3://{BUCKET_NAME}/images/{file_id}/{filename}"
            thumbnail_url = f"s3://{BUCKET_NAME}/thumbnails/{file_id}/{filename}"
            file_type = 'image'
            images += 1
        else:
            filename = random.choice(VIDEO_NAMES)
            file_url = f"s3://{BUCKET_NAME}/images/{file_id}/{filename}"
            thumbnail_url = None
            file_type = 'video'
            videos += 1

        checksum = generate_checksum(file_url)

        item = {
            'file_id':    file_id,
            'checksum':   checksum,
            'file_url':   file_url,
            'file_type':  file_type,
            'tags':       random_tags(),
            'uploaded_at': random_timestamp(),
            'user_id':    USER_ID,
        }

        if thumbnail_url:
            item['thumbnail_url'] = thumbnail_url

        table.put_item(Item=item)

        if (i + 1) % 10 == 0:
            print(f"  {i + 1}/{n} records inserted...")

    print(f"\nDone! {n} records seeded.")
    print(f"  Images: {images}")
    print(f"  Videos: {videos}")


if __name__ == '__main__':
    seed(100)


    