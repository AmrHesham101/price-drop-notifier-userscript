# Testing with Postman

1. Ensure the server is running (`npm run dev` or `npm start`). If port 3000 is in use, set `PORT` environment variable before starting, e.g.:

```powershell
$env:PORT=3001; npm run dev
```

2. Import the collection file `postman/PriceDropNotifier.postman_collection.json` into Postman.

3. Run the request `Subscribe Price Drop` (POST `http://localhost:3000/subscribe-price-drop`).

4. Example request body (JSON):

```json
{
  "email": "user@example.com",
  "product": {
    "name": "Demo Product",
    "price": "USD 129.99",
    "url": "https://example.com/p/1"
  }
}
```

5. Expected responses:

- 200: { "ok": true }
- 400: { "ok": false, "error": "invalid_email" }
- 409: { "ok": false, "error": "already_subscribed" }
- 5xx: simulated server error

6. Troubleshooting:

- If you get connection refused, check server is running and the port matches the collection URL.
- If you need to change the port, edit the request URL in Postman or set the `port` field in the collection.
