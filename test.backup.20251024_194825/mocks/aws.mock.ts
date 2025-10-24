import { rest } from 'msw';

// AWS S3 API mocks
export const s3Mocks = [
  // Mock list buckets
  rest.get('https://s3.amazonaws.com/', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'application/xml'),
      ctx.body(`<?xml version="1.0" encoding="UTF-8"?>
        <ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
          <Owner>
            <ID>test-owner-id</ID>
            <DisplayName>test-owner</DisplayName>
          </Owner>
          <Buckets>
            <Bucket>
              <Name>labelmint-test-uploads</Name>
              <CreationDate>2024-01-01T00:00:00.000Z</CreationDate>
            </Bucket>
            <Bucket>
              <Name>labelmint-test-labels</Name>
              <CreationDate>2024-01-01T00:00:00.000Z</CreationDate>
            </Bucket>
          </Buckets>
        </ListAllMyBucketsResult>`)
    );
  }),

  // Mock create bucket
  rest.put('https://s3.amazonaws.com/:bucketName', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Location', `/${req.params.bucketName}`),
      ctx.body('')
    );
  }),

  // Mock head object (check if object exists)
  rest.head('https://s3.amazonaws.com/:bucketName/:key(*)', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Last-Modified', new Date().toUTCString()),
      ctx.set('Content-Length', '12345'),
      ctx.set('ETag', '"test-etag-12345"'),
      ctx.set('Content-Type', 'image/jpeg')
    );
  }),

  // Mock get object
  rest.get('https://s3.amazonaws.com/:bucketName/:key(*)', (req, res, ctx) => {
    // Return mock image data for testing
    const mockImageData = Buffer.alloc(1024, 0xFF);
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'image/jpeg'),
      ctx.set('Content-Length', mockImageData.length.toString()),
      ctx.set('ETag', '"test-etag-12345"'),
      ctx.body(mockImageData)
    );
  }),

  // Mock put object
  rest.put('https://s3.amazonaws.com/:bucketName/:key(*)', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('ETag', '"test-etag-67890"'),
      ctx.body('')
    );
  }),

  // Mock delete object
  rest.delete('https://s3.amazonaws.com/:bucketName/:key(*)', (req, res, ctx) => {
    return res(
      ctx.status(204),
      ctx.body('')
    );
  }),

  // Mock list objects
  rest.get('https://s3.amazonaws.com/:bucketName', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'application/xml'),
      ctx.body(`<?xml version="1.0" encoding="UTF-8"?>
        <ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
          <Name>${req.params.bucketName}</Name>
          <Prefix></Prefix>
          <Marker></Marker>
          <MaxKeys>1000</MaxKeys>
          <IsTruncated>false</IsTruncated>
          <Contents>
            <Key>test-image-1.jpg</Key>
            <LastModified>2024-01-01T12:00:00.000Z</LastModified>
            <ETag>"test-etag-12345"</ETag>
            <Size>12345</Size>
            <StorageClass>STANDARD</StorageClass>
          </Contents>
          <Contents>
            <Key>test-label-1.json</Key>
            <LastModified>2024-01-01T12:01:00.000Z</LastModified>
            <ETag>"test-etag-67890"</ETag>
            <Size>678</Size>
            <StorageClass>STANDARD</StorageClass>
          </Contents>
        </ListBucketResult>`)
    );
  }),

  // Mock generate presigned URL endpoint (custom API)
  rest.post('https://s3.amazonaws.com/:bucketName/presigned-url', (req, res, ctx) => {
    const { key, operation, expiresIn = 3600 } = req.body;

    const baseUrl = 'https://s3.amazonaws.com';
    const bucket = req.params.bucketName;
    const expires = new Date(Date.now() + expiresIn * 1000).toISOString();

    const presignedUrl = `${baseUrl}/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test-key/${expires.substr(0,10)}/us-east-1/s3/aws4_request&X-Amz-Date=${expires.substr(0,19).replace(/[-:]/g, '')}Z&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=test-signature`;

    return res(
      ctx.status(200),
      ctx.json({
        url: presignedUrl,
        key,
        expires: expiresIn,
        operation
      })
    );
  })
];

// Mock S3 presigned URL generation
export const createMockPresignedUrl = (
  bucket: string,
  key: string,
  operation: 'putObject' | 'getObject' = 'putObject',
  expiresIn: number = 3600
) => {
  const timestamp = new Date();
  const expires = new Date(timestamp.getTime() + expiresIn * 1000);

  return `https://s3.amazonaws.com/${bucket}/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test-key/${expires.toISOString().substr(0,10)}/us-east-1/s3/aws4_request&X-Amz-Date=${timestamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}Z&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=test-signature-${Date.now()}`;
};

// Mock file upload response
export const createMockUploadResponse = (key: string, bucket: string) => ({
  Location: `https://${bucket}.s3.amazonaws.com/${key}`,
  Key: key,
  Bucket: bucket,
  ETag: '"mock-etag-' + Date.now() + '"'
});

// Mock file download info
export const createMockFileInfo = (key: string, bucket: string) => ({
  Key: key,
  Bucket: bucket,
  ContentLength: Math.floor(Math.random() * 10000000),
  LastModified: new Date(),
  ContentType: key.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream',
  Metadata: {
    'uploaded-by': 'test-user',
    'purpose': 'data-labeling'
  }
});

// Mock multipart upload responses
export const createMockMultipartUpload = (key: string, bucket: string) => ({
  UploadId: 'mock-upload-id-' + Date.now(),
  Key: key,
  Bucket: bucket
});

export const createMockUploadPart = (partNumber: number, uploadId: string) => ({
  PartNumber: partNumber,
  ETag: `"mock-etag-part-${partNumber}-${Date.now()}"`
});

export const createMockCompleteMultipart = (key: string, bucket: string) => ({
  Location: `https://${bucket}.s3.amazonaws.com/${key}`,
  Bucket: bucket,
  Key: key,
  ETag: '"mock-complete-etag-' + Date.now() + '"'
});

// AWS SQS mocks for task queue
export const sqsMocks = [
  // Mock send message
  rest.post('https://sqs.us-east-1.amazonaws.com/:accountId/:queueName', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/xml'),
      ctx.body(`<?xml version="1.0"?>
        <SendMessageResponse>
          <SendMessageResult>
            <MD5OfMessageBody>${Buffer.from('test message').toString('base64')}</MD5OfMessageBody>
            <MD5OfMessageAttributes></MD5OfMessageAttributes>
            <MessageId>test-message-id-${Date.now()}</MessageId>
            <SequenceNumber></SequenceNumber>
          </SendMessageResult>
          <ResponseMetadata>
            <RequestId>test-request-id</RequestId>
          </ResponseMetadata>
        </SendMessageResponse>`)
    );
  }),

  // Mock receive message
  rest.get('https://sqs.us-east-1.amazonaws.com/:accountId/:queueName', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/xml'),
      ctx.body(`<?xml version="1.0"?>
        <ReceiveMessageResponse>
          <ReceiveMessageResult>
            <Message>
              <MessageId>test-message-id-${Date.now()}</MessageId>
              <ReceiptHandle>test-receipt-handle-${Date.now()}</ReceiptHandle>
              <MD5OfBody>${Buffer.from('test message').toString('base64')}</MD5OfBody>
              <Body>{\"type\":\"task_assignment\",\"taskId\":123}</Body>
            </Message>
          </ReceiveMessageResult>
          <ResponseMetadata>
            <RequestId>test-request-id</RequestId>
          </ResponseMetadata>
        </ReceiveMessageResponse>`)
    );
  }),

  // Mock delete message
  rest.delete('https://sqs.us-east-1.amazonaws.com/:accountId/:queueName', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/xml'),
      ctx.body(`<?xml version="1.0"?>
        <DeleteMessageResponse>
          <ResponseMetadata>
            <RequestId>test-request-id</RequestId>
          </ResponseMetadata>
        </DeleteMessageResponse>`)
    );
  })
];

// Mock SNS for notifications
export const snsMocks = [
  // Mock publish
  rest.post('https://sns.us-east-1.amazonaws.com/:topicArn', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/xml'),
      ctx.body(`<?xml version="1.0"?>
        <PublishResponse>
          <PublishResult>
            <MessageId>test-sns-message-id-${Date.now()}</MessageId>
          </PublishResult>
          <ResponseMetadata>
            <RequestId>test-request-id</RequestId>
          </ResponseMetadata>
        </PublishResponse>`)
    );
  })
];