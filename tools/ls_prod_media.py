
import subprocess
import time
import sys

password = "Pe!S3_S?r9*Hn7D"
host = "root@46.101.96.41"
# Check file names in media_data
command = 'ls -la /root/app/media_data'

def run_ssh():
    process = subprocess.Popen(
        ["ssh", "-tt", host, command],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        bufsize=1
    )

    # Wait for password prompt
    output = ""
    while True:
        char = process.stdout.read(1)
        if not char: break
        output += char
        if "password:" in output.lower():
            process.stdin.write(password + "\n")
            process.stdin.flush()
            break
    
    # Print remaining output
    while True:
        line = process.stdout.readline()
        if not line: break
        print(line, end="")
    
    process.wait()

if __name__ == "__main__":
    run_ssh()
