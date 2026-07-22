CREATE USER wms_user WITH PASSWORD 'wms_password';
GRANT ALL PRIVILEGES ON DATABASE wms_vinhgiang TO wms_user;
ALTER DATABASE wms_vinhgiang OWNER TO wms_user;
