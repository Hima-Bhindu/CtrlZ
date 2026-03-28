import urllib.request
import json
import uuid

def test():
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    # Upload
    req = urllib.request.Request('http://localhost:8000/upload', method='POST')
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    body = f'--{boundary}\r\nContent-Disposition: form-data; name="expires_in"\r\n\r\n60\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="foo.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--{boundary}--\r\n'.encode('utf-8')
    resp = urllib.request.urlopen(req, data=body)
    data = json.loads(resp.read().decode())
    print("Upload Result:", data)
    
    file_id = data['file_id']
    sec_key = data['secret_key']

    # Recover
    req2 = urllib.request.Request('http://localhost:8000/recover', method='POST')
    req2.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    body2 = f'--{boundary}\r\nContent-Disposition: form-data; name="file_id"\r\n\r\n{file_id}\r\n--{boundary}\r\nContent-Disposition: form-data; name="secret_key"\r\n\r\n{sec_key}\r\n--{boundary}--\r\n'.encode('utf-8')
    resp2 = urllib.request.urlopen(req2, data=body2)
    print("Recovered:", resp2.read().decode())

test()
