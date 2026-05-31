# Serverless Image Resizer

A serverless image processing pipeline built on AWS that allows users to upload images, automatically generates resized variants, stores metadata in DynamoDB, and provides secure download URLs for the processed images.

## Architecture

```text
Frontend (Vite + React)
        |
        v
Presign Lambda (Function URL)
        |
        v
  DynamoDB Metadata
        |
        v
 Presigned S3 Upload URL
        |
        v
 Original S3 Bucket
        |
        v
   S3 Event Notification
        |
        v
        SQS
        |
        v
 Image Resizer Lambda
        |
        +------> Resized S3 Bucket
        |
        +------> DynamoDB Status Update
        |
        v
Frontend Fetches Results
```

---

## Features

* Secure direct-to-S3 uploads using presigned URLs
* Automatic image resizing using AWS Lambda and Sharp
* Multiple image variants:

  * Thumb
  * Small
  * Medium
  * Large
* Metadata storage in DynamoDB
* Asynchronous processing using SQS
* Secure download links using presigned GET URLs
* Fully serverless architecture

---

## AWS Services Used

### Amazon S3

Stores:

* Original uploaded images
* Resized image variants

### AWS Lambda

#### Presign Lambda

Responsible for:

* Generating upload URLs
* Creating image metadata records
* Returning download URLs

#### Image Resizer Lambda

Responsible for:

* Consuming SQS messages
* Downloading original images
* Resizing images using Sharp
* Uploading resized variants
* Updating DynamoDB status

### Amazon SQS

Acts as a buffer between:

* S3 Upload Events
* Image Processing Lambda

Benefits:

* Decouples services
* Handles traffic spikes
* Improves reliability

### Amazon DynamoDB

Stores metadata such as:

```json
{
  "PK": "USER#u1",
  "SK": "IMAGE#1234",
  "status": "DONE",
  "originalKey": "uploads/u1/1234.jpg",
  "createdAt": "2026-05-26T12:00:00Z"
}
```

---

## Buckets

### Original Images Bucket

```text
myapp-original-images-<account-id>-<region>
```

Example object:

```text
uploads/u1/1471b5e1-0603-496e-a9a6-4a8832a2f9e8.jpg
```

---

### Processed Images Bucket

```text
myapp-processed-images-<account-id>-<region>
```

Example objects:

```text
processed/uploads/u1/1471b5e1-0603-496e-a9a6-4a8832a2f9e8/thumb.webp
processed/uploads/u1/1471b5e1-0603-496e-a9a6-4a8832a2f9e8/small.webp
processed/uploads/u1/1471b5e1-0603-496e-a9a6-4a8832a2f9e8/medium.webp
processed/uploads/u1/1471b5e1-0603-496e-a9a6-4a8832a2f9e8/large.webp
```

---

## API Endpoints

### Generate Upload URL

```http
POST /presign
```

Request:

```json
{
  "userId": "u1",
  "ext": "jpg",
  "contentType": "image/jpeg"
}
```

Response:

```json
{
  "uploadUrl": "...",
  "imageId": "1471b5e1-0603-496e-a9a6-4a8832a2f9e8",
  "key": "uploads/u1/1471b5e1-0603-496e-a9a6-4a8832a2f9e8.jpg"
}
```

---

### Get Processed Images

```http
GET /results?userId=u1&imageId=<imageId>
```

Response:

```json
{
  "status": "done",
  "items": [
    {
      "label": "small.webp",
      "url": "..."
    },
    {
      "label": "medium.webp",
      "url": "..."
    }
  ]
}
```

---

## Environment Variables

### Presign Lambda

```env
BUCKET_NAME=myapp-original-images
RESIZED_BUCKET_NAME=myapp-processed-images
TABLE_NAME=ImageMetadata
URL_EXPIRES_SECONDS=900
```

### Image Resizer Lambda

```env
DEST_BUCKET=myapp-processed-images
DEST_PREFIX=processed
DDB_TABLE=ImageMetadata
```

---

## Local Frontend Setup

Install dependencies:

```bash
npm install
```

Run:

```bash
npm run dev
```

Build:

```bash
npm run build
```

---

## Upload Flow

1. User selects image.
2. Frontend requests a presigned URL.
3. Presign Lambda creates metadata record.
4. Frontend uploads image directly to S3.
5. S3 sends event notification to SQS.
6. Image Resizer Lambda consumes the message.
7. Lambda downloads original image.
8. Sharp generates resized variants.
9. Resized images are uploaded to processed bucket.
10. DynamoDB status is updated.
11. Frontend fetches download URLs.
12. User downloads processed images.

---

## Security

* Original bucket is private.
* Processed bucket is private.
* Uploads use presigned PUT URLs.
* Downloads use presigned GET URLs.
* No public S3 access required.
* IAM permissions follow least-privilege principles.

---

## Future Improvements

* User authentication with Cognito
* Image deletion support
* CloudFront distribution
* WebSocket status updates
* Thumbnail gallery
* Image compression controls
* Watermarking support
* AVIF image generation
* Multi-region deployment

---

## Tech Stack

Frontend:

* React
* Vite

Backend:

* AWS Lambda
* Node.js
* AWS SDK v3
* Sharp

Storage:

* Amazon S3
* DynamoDB

Messaging:

* Amazon SQS

Infrastructure:

* AWS IAM
* Lambda Function URLs
* CloudWatch Logs
