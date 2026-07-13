import asyncio
import logging

logger = logging.getLogger("smtp_mock")

async def handle_smtp(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    logger.info("New mock SMTP connection established.")
    writer.write(b"220 localhost ESMTP MockServer\r\n")
    await writer.drain()
    
    try:
        while True:
            data = await reader.readline()
            if not data:
                break
            line = data.decode('utf-8', errors='ignore').strip()
            
            if line.upper().startswith("EHLO") or line.upper().startswith("HELO"):
                writer.write(b"250-localhost\r\n250-8BITMIME\r\n250 SIZE 10485760\r\n")
            elif line.upper().startswith("MAIL FROM:"):
                writer.write(b"250 2.1.0 Ok\r\n")
            elif line.upper().startswith("RCPT TO:"):
                writer.write(b"250 2.1.5 Ok\r\n")
            elif line.upper() == "DATA":
                writer.write(b"354 End data with <CR><LF>.<CR><LF>\r\n")
                await writer.drain()
                email_body = []
                while True:
                    body_data = await reader.readline()
                    if not body_data:
                        break
                    body_line = body_data.decode('utf-8', errors='ignore')
                    if body_line.strip() == ".":
                        break
                    email_body.append(body_line)
                
                full_body = "".join(email_body)
                print(f"\n================= MOCK SMTP RECEIVED EMAIL =================")
                print(full_body)
                print(f"==========================================================\n")
                
                writer.write(b"250 2.0.0 Ok: queued as mock-12345\r\n")
            elif line.upper() == "QUIT":
                writer.write(b"221 2.0.0 Bye\r\n")
                await writer.drain()
                break
            else:
                writer.write(b"250 Ok\r\n")
            await writer.drain()
    except Exception as e:
        logger.debug(f"Mock SMTP session closed: {e}")
    finally:
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass

async def start_mock_smtp_server_task():
    """Starts the mock SMTP server on localhost:1025 if settings configure it as localhost."""
    from app.core.config import settings
    if settings.MAIL_SERVER not in ("localhost", "127.0.0.1"):
        logger.info("Custom external SMTP server configured. Mock SMTP server startup bypassed.")
        return
        
    try:
        server = await asyncio.start_server(handle_smtp, '127.0.0.1', 1025)
        logger.info("Mock SMTP Server listening on 127.0.0.1:1025")
        async with server:
            await server.serve_forever()
    except Exception as e:
        logger.info(f"Mock SMTP server not started (port 1025 might be occupied): {e}")
