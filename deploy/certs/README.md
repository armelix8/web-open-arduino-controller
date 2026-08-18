# Place TLS certificates here for local/prod Docker nginx:
# - fullchain.pem
# - privkey.pem
#
# Generate a local self-signed cert:
# openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
#   -keyout privkey.pem -out fullchain.pem -subj "/CN=localhost"
