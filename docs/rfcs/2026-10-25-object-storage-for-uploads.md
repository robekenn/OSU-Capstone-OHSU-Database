<!-- docs/rfcs/2026-10-25-object-storage-for-uploads.md -->

# RFC: Object Storage for Uploads.md


| Field | Value |
| --- | --- |
| Author |William Zhao |
| Date | YYYY-MM-DD |
| Status | Proposed / Accepted / Rejected / Superseded |
| Decision Date | (fill when decided) |
| Deciders | (who agreed to the outcome) |
| Superseded By | (link, if applicable) |

## Problem and Context

Our team needs a reliable way to store files for simulation cases. Curretly, our client works with case materials such as Microsoft word doc and PDF. In the new system, an user should be able to import their old files with a new case. At this point we therefore needd a file storage architecture for structured case info.

The decision is whether uploaded files should be stored in Amazon S3, Directly inside the DB, a substitute object storage, or remain outside the app.
Once many files and DB records refer to a particular solution, changing the architecture then would require migrating files and updating chunks of references from the app. This would be a hard to reverse architectural decision.

Our team also must consider recovery. Amazon S3 can move files between storage classes with Lifecycle Transition rules. A transition does not delete the file and a Lifecycle Expiration rule can delete a file. The team must not use automatic permanent deletion until it knows the retention requirements from the client.

If the team ultimates chose to do nothing, our client would then continues to manage docs outside the app. This is certainly less development task, but it does not provide a consistent system for the client. It would make it impossible to demo.
## Options
### Option A: [Amazon S3]
Description:
    The application stores files in an Amazon S3 bucket. The database stores metadata and the S3 object key.
benefits:
    Consistent - does not depend entirely on the app server.
    Supports lifecycle rules
    Industry level encryption.
Costs:
    Bills from AWS service
    Learning costs (SDK)
    Wrong setup could jeoperdize protected data into public
This option makes sense since file storage are a permanent part of our app. 

### Option B: [Relational DB storage]
Description:
    The app stores files as binary data in the relational DB. 
benefits:
    This keeps files and cases both in one system.
costs:
    This drastically increase db size and backup requirements.
This option makes sense  when the project has few and small files.

### Option C: [Other Object Storage]
Description:
    Use an existing S3-compatible or cloud object storage service such as MinIO, Azure Blob, GCS, Cloudflare R2
benefits:
    May have no additinal
    S3 compatible
    May make more sense when the client brought up any existing file storage system.
costs:
    Not 100% like Amazon S3
    Learning cost

### Option D: Do Nothing

We hold it on google drive/github if we do nothing. This would not be a safe option, and we cannot demo. Cannot redeploy eazily. This would cost us debt in the soon future.

We do nothing only if there are an existing API brought by the client for filesystem. 

## Analysis

Amazon s3 is an object storage service. Each object stored in a bucket and has an object key.[1] Our DB can store the key with the case ID and the file metadata and S3 can then store the file. This seprates files storage from the relational DB also seperates from the app server. Thus the team can update the app server without moving all stored files.
Furthermore, securitywise, S3 encrypts new objects by default. The team can also keep the buckt private and allow the app to control file access.However wrong permission setup can still create a risk.

S3 Versioning can keep multiple versions of a same object, this aligns with the client's request.  Lifecycle rules could be enforced in some cases.

Other object storage may work . If the client already has MinIO, Azure, GCS, or another system, that could be better and cheaper for handoff. We still do not know this yet.We have to check with to our client about the cost. We also need further clarity about metadata and deletion rules.
This all makes Amazon S3 a good default at this stage.

## Recommendation and Verification Plan
I recommend Option A: Amazon S3.
S3 separates persistent files from the database and application server. It also provides encryption, Versioning, and lifecycle controls.
We know it works when we use a private S3 bucket, store file metadata in the DB, store the files in S3, enable Versioning, avoid automatic permanent expiration.

We know it works when:
1 A user can upload a Word file and a PDF.
2 The DB stores the correct case ID and object key.
3 The user can download the same files again.
4 The Unauthorized user cannot access the files.
5 When Versioning can recover an older version of a test file.
6 No unexpected automatic expiration deletes
## Constraints
Licensing is not an issue, Amazon S3 is a paid AWS service. We have to follow AWS service terms and the AWS account will need to stay available after our capstone ends. 

We need to confirm what type of information can appear inside the simulation files. Some files may include medical or other sensitive information. 

For IP, the case files belongs to the client. Our team should only use these files for this project and should not put them into public GitHub repo.

Partner confidentiality also matters here. Actual client documents strictly should not be used as random test files or sent to outside AI tools. For development, fake case files can be used first. Real files should only be stored after the client confirms the storage solution and permissions.

## Delegation and Validation

- **What you handed to AI tools** I used AI for part of this decision. Mainly to understand what Amazon S3 does, what lifecycle transition means, compare S3 with other storage systems, and help organize this RFC. I also used it to find things I did not understand like object key, Versioning, and expiration.

- **What checks made that reasonable**: I cited from Amazon S3 official guide. At this stage there are no file storage design or implementation made.
- **Where you stopped and validated the result yourself, and why those points.** 
-- I finished A3 research only on a conceptual level but not on an implementing level. I have not yet personally implement the above utilities.

What is assessed is in the [AI policy](https://capstone.alexulbrich.com/assignments/introduction/#ai-policy-applies-to-every-assignment).

## References
1.AWS Amazon S3 What is Amazon S3? https://aws.amazon.com/s3/?trk=50b671a1-06f5-4224-9505-fa45ee881c08&sc_channel=ps&ef_id=CjwKCAjw0fbWBhBkEiwAwJuQ8Ru13sJYcUjGV0mW1hp_CuXLHyOUWetDSgJ6u4k_UeDcMYvDoiVzYxoCp1sQAvD_BwE:G:s&gads_camp=23522747487&gads_ag=196433733807&gads_ad=795876995201&gads_kw=aws%20s3&gads_matchtype=p&gads_network=g&gads_device=c&gads_geo=9032981&gad_campaignid=23522747487&gbraid=0AAAAADjHtp_uJWCCmeYTBVmRzu_e1xRRD&gclid=CjwKCAjw0fbWBhBkEiwAwJuQ8Ru13sJYcUjGV0mW1hp_CuXLHyOUWetDSgJ6u4k_UeDcMYvDoiVzYxoCp1sQAvD_BwE
2. AWS Amazon S3 User Guide https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
3. Amazon Web Services. Default encryption FAQ. Amazon S3 User Guide.
https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html
4. Amazon Web Services. How S3 Versioning works. Amazon S3 User Guide.
https://docs.aws.amazon.com/AmazonS3/latest/userguide/versioning-workflows.html
## Decision

Proposed, until your team decides. Then accepted, rejected, or superseded, with the date and who chaired the decision. If superseded, link the RFC that replaces this one.