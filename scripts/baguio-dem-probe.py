"""Sample AWS Terrarium DEM at known Baguio landmarks and compare to the app's DB elevations.
Pure stdlib: minimal PNG decoder (RGB/RGBA, filters 0-4) + slippy-tile math."""
import math, struct, urllib.request, zlib

def deg2tile(lon, lat, z):
    n = 2 ** z
    xf = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    yf = (1.0 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return int(xf), int(yf), xf, yf

def decode_png(data):
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not png"
    pos, idat, w = 8, b"", None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b"IHDR":
            w, h, bd, ct, comp, filt, il = struct.unpack(">IIBBBBB", chunk)
            assert bd == 8 and ct in (2, 6) and il == 0, f"unsupported png ct={ct} bd={bd} il={il}"
            nch = 3 if ct == 2 else 4
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
        pos += 12 + ln
    raw = zlib.decompress(idat)
    stride = w * nch
    out, prev = [], bytearray(stride)
    p = 0
    for _ in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(nch, stride): line[i] = (line[i] + line[i-nch]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-nch] if i >= nch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-nch] if i >= nch else 0
                b = prev[i]
                c = prev[i-nch] if i >= nch else 0
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out.append(bytes(line)); prev = line
    return w, h, nch, out

def elevation(lon, lat, z=14):
    xt, yt, xf, yf = deg2tile(lon, lat, z)
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{xt}/{yt}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "baguio-dem-probe/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        png = r.read()
    w, h, nch, rows = decode_png(png)
    px = min(w - 1, max(0, int((xf - xt) * w)))
    py = min(h - 1, max(0, int((yf - yt) * h)))
    row = rows[py]
    R, G, B = row[px*nch], row[px*nch+1], row[px*nch+2]
    return (R * 256 + G + B / 256.0) - 32768.0, url, (px, py)

# Known values from data/geojson/landmarks.geojson (elevation_m) + app constants
POINTS = [
    ("burnham-park",     120.5936, 16.4116, 1400),
    ("mines-view-park",  120.6305, 16.4145, 1540),
    ("session-road",     120.5967, 16.4118, None),
    ("camp-john-hay",    120.6187, 16.3956, None),
    ("BAGUIO_CENTER",    120.5960, 16.4023, None),
    ("kennon-road(low)", 120.6050, 16.3650, None),
]

print(f"{'point':18} {'DEM m':>9} {'DB m':>7} {'delta':>8}")
print("-" * 46)
for name, lon, lat, db in POINTS:
    try:
        e, url, px = elevation(lon, lat)
        d = f"{e-db:+.0f}" if db else "--"
        dbs = str(db) if db else "--"
        print(f"{name:18} {e:9.1f} {dbs:>7} {d:>8}")
    except Exception as ex:
        print(f"{name:18} ERROR {ex}")
