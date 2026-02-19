## API Documentation

### Articles

Articles are documents containing a title, status, a description (markdown), can contain an external URL, client comments, tags and files, and is defined in the backend as follows:
```cs
public class Article
{
    public string Id { get; set; }
    public string CompanyId { get; set; }
    public string Title { get; set; }
    public string Description { get; set; }
    public string ExternalLink { get; set; }
    public string? ClientComments { get; set; }
    public string Status { get; set; }
    public IReadOnlyList<string> Tags { get; set; }
    public DateOnly CreatedAt { get; set; }
    public DateOnly UpdatedAt { get; set; }
}
```

### Files

```cs
public class FileAsset
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Extension { get; set; }
    public long SizeBytes { get; set; }
    public DateOnly UploadDate { get; set; }
    public string CompanyId { get; set; }
    public IReadOnlyList<string> LinkedArticles { get; set; }
    public Uri? ThumbnailUrl { get; set; }
    public long? Width { get; set; }
    public long? Height { get; set; }
}
```

### Companies

```cs
public class Company
{
    public string Id { get; set; }
    public string Name { get; set; }
    public CompanySettings Settings { get; set; }

    public Company()
    {
        Id = string.Empty;
        Name = string.Empty;
        Settings = new CompanySettings();
}

public class CompanySettings
{
    public bool AllowUserUploads { get; set; }
    public bool AllowUserTagCreation { get; set; }
    public bool RequireClientComments { get; set; }
}
```

### Tags

```cs
public class Tag
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Color { get; set; }
    public string Description { get; set; }
    public string CompanyId { get; set; }
}
```
### Endpoints

Base route:
/api

---

#### ARTICLES

##### 1. GET /api/articles

Description: Get articles (filtered)

Mandatory:
- companyId string

Optional Query Params:
- status (string)
- title (string)
- fromDate (date)
- toDate (date)

Body:
- None


---

## 2. GET /api/articles/{id}

Description: Get article by ID

Mandatory:
- id (route)
- companyId (query param)

Optional:
- None

Body:
- None


---

##### 3. POST /api/articles

Description: Create article

Mandatory Query Param:
- companyId string

Mandatory Body:
```
{
  "title": "string",
  "description": "string | null",
  "externalLink": "string | null",
  "clientComments": "string | null",
  "status": "string",
  "tagIds": ["string"] | null,
}
```

Optional:
- None


---

##### 4. PUT /api/articles/{id}

Description: Update article (partial update using NULL-safe SQL pattern)

Mandatory:
- id (route)
- companyId (query param)

Body (all optional except at least one required logically):
```
{
  "title": "string | null",
  "description": "string | null",
  "externalLink": "string | null",
  "clientComments": "string | null",
  "status": "string | null",
  "tagIds": ["string"] | null
}
```


---

##### 5. DELETE /api/articles/{id}

Description: Delete article

Mandatory:
- id (route)
- companyId (query param)

Body:
- None


---

##### 6. POST /api/articles/bulk-tags

Description: Add or remove a tag from multiple articles

Mandatory Query Param:
- companyId string

Mandatory Body:
```
{
  "articleIds": ["int"],
  "tagId": int,
  "action": "add | remove"
}
```

Optional:
- None

Response:
```
{
  "status": "string",
  "updatedCount": number
}
```


---

#### TAGS

##### 7. GET /api/tags

Description: Get all tags for a company

Mandatory Query Param:
- companyCode (string)

Body:
- None


---

##### 8. GET /api/tags/{id}

Description: Get tag by ID

Mandatory:
- id (route)

Body:
- None


---

##### 9. POST /api/tags

Description: Create tag

Mandatory Query Param:
- companyCode string

Mandatory Body:
```
{
  "name": "string",
  "color": "string | null",
  "description": "string | null"
}
```


---

##### 10. PUT /api/tags/{id}

Description: Update tag

Mandatory:
- id (route)

Body (partial update supported):
```
{
  "name": "string | null",
  "color": "string | null",
  "description": "string | null"
}
```


---

##### 11. DELETE /api/tags/{id}

Description: Delete tag

Mandatory:
- id (route)

Body:
- None


---

#### FILES

##### 12. POST /api/files

Description: Create file metadata record

Mandatory Query Param:
- companyId string

Mandatory Body:
```
{
  "file": "binary file data",
}
```


---

##### 13. PUT /api/files/{id}

Description: Update file metadata (NULL-safe SQL update)

Mandatory:
- id (route)
- companyId (query param)

Body (all optional):
```
{
  "name": "string | null",
  "description": "string | null"
}
```


---

##### 14. DELETE /api/files/{id}

Description: Delete file record

Mandatory:
- id (route)
- companyId (query param)

Body:
- None
