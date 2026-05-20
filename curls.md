POST /shorten — Create a short URL
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.example.com/some/long/path"}'
GET /:code — Redirect to original URL- x
curl -v http://localhost:3000/abc123
(Replace abc123 with the short_code from the POST response. Use -v to see the 302 redirect header.)
GET /stats/:code — Get visit stats
curl http://localhost:3000/stats/abc123
GET /admin/top — Top 10 most visited
curl http://localhost:3000/admin/top
Testing error cases
Missing URL (should be 400):
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{}'
Invalid URL (should be 400):
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "not-a-url"}'
Non-existent code (should be 404): - x
curl http://localhost:3000/stats/nonexistent
SQL injection test (should be 404, not return data):
curl "http://localhost:3000/stats/' OR '1'='1"
Rate limit test (11 rapid requests — 11th should be 429):
 
for i in $(seq 1 11); do
  echo "Request $i:"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://localhost:3000/shorten \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"https://example.com/$i\"}"
done