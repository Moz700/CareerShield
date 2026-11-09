"""Title dictionaries used before the lexical matcher.

HAND_VERIFIED and PROXY are the hand-verified titles of the original interface (app.py, section
11.1), kept exactly. MALAYSIAN_TITLES replaces the posting-derived Malaysian dictionary of the
original (ALIAS2SOC), which was built from the JobStreet postings file. That file is not
redistributed, so the dictionary below was compiled by hand from common Bahasa Malaysia and
Malaysian English job titles, each checked against the O*NET occupation it points to.
"""

HAND_VERIFIED = {
    'data analyst': '15-2051.01', 'business intelligence analyst': '15-2051.01', 'bi analyst': '15-2051.01',
    'data scientist': '15-2051.00', 'machine learning engineer': '15-2051.00', 'ai engineer': '15-2051.00',
    'data engineer': '15-1243.01', 'business analyst': '13-1111.00', 'management consultant': '13-1111.00',
    'software engineer': '15-1252.00', 'software developer': '15-1252.00', 'programmer': '15-1251.00',
    'web developer': '15-1254.00', 'ui ux designer': '15-1255.00', 'ux designer': '15-1255.00',
    'ui designer': '15-1255.00', 'qa engineer': '15-1253.00', 'software tester': '15-1253.00',
    'cybersecurity analyst': '15-1212.00', 'security analyst': '15-1212.00', 'network engineer': '15-1241.00',
    'accountant': '13-2011.00', 'auditor': '13-2011.00', 'financial analyst': '13-2051.00',
    'hr executive': '13-1071.00', 'human resource executive': '13-1071.00', 'recruiter': '13-1071.00',
    'admin executive': '43-6014.00', 'administrative executive': '43-6014.00',
    'customer service executive': '43-4051.00', 'marketing executive': '13-1161.00',
    'digital marketing executive': '13-1161.00', 'digital marketer': '13-1161.00',
    'sales executive': '41-3091.00', 'project manager': '13-1082.00', 'graphic designer': '27-1024.00',
    'content writer': '27-3043.00', 'copywriter': '27-3043.00', 'video editor': '27-4032.00',
    'lecturer': '25-1199.00', 'academic teacher': '25-1199.00', 'university lecturer': '25-1199.00',
    'primary school teacher': '25-2021.00', 'secondary school teacher': '25-2031.00',
    'nurse': '29-1141.00', 'pharmacist': '29-1051.00', 'receptionist': '43-4171.00', 'cashier': '41-2011.00',
}

PROXY = {
    '41-3091.00': ('41-4012.00', 'closest available: wholesale and manufacturing sales representative'),
    '25-1199.00': ('25-1011.00', 'closest available: business teacher, postsecondary'),
    '13-2051.00': ('13-2099.01', 'closest available: financial quantitative analyst'),
    '15-1255.00': ('15-1254.00', 'closest available: web developer'),
}

# Two codes of the original dictionary are not in the 894-occupation table, so the original
# interface dropped their four titles. The web app maps them to the closest occupation instead and
# says so on screen.
APP_PROXY = {
    '15-2051.00': ('15-2041.00', 'closest available: statisticians'),
    '13-1082.00': ('15-1299.09', 'closest available: information technology project managers'),
}

MALAYSIAN_TITLES = {
    # office and administration
    'kerani': '43-9061.00', 'kerani am': '43-9061.00', 'kerani pejabat': '43-9061.00',
    'kerani pentadbiran': '43-9061.00', 'general clerk': '43-9061.00', 'admin clerk': '43-9061.00',
    'office clerk': '43-9061.00', 'kerani akaun': '43-3031.00', 'accounts clerk': '43-3031.00',
    'accounts executive': '43-3031.00', 'account executive accounting': '43-3031.00',
    'account assistant': '43-3031.00', 'pembantu akaun': '43-3031.00', 'pembantu akauntan': '43-3031.00',
    'pembantu tadbir': '43-6014.00', 'pembantu pentadbiran': '43-6014.00', 'setiausaha': '43-6014.00',
    'personal assistant': '43-6011.00', 'setiausaha eksekutif': '43-6011.00',
    'penyambut tetamu': '43-4171.00', 'front desk': '43-4171.00', 'payroll executive': '43-3051.00',
    'kerani gaji': '43-3051.00', 'credit control executive': '43-3011.00', 'pemungut hutang': '43-3011.00',
    'kerani stor': '43-5071.00', 'storekeeper': '43-5071.00', 'penjaga stor': '43-5071.00',
    'store keeper': '43-5071.00', 'penyelia pejabat': '43-1011.00', 'admin supervisor': '43-1011.00',
    'kerani pembelian': '43-3061.00', 'purchasing executive': '13-1023.00', 'procurement executive': '13-1023.00',
    'pegawai perolehan': '13-1023.00', 'logistics executive': '13-1081.00', 'eksekutif logistik': '13-1081.00',
    'pegawai khidmat pelanggan': '43-4051.00', 'khidmat pelanggan': '43-4051.00',
    'call centre agent': '43-4051.00', 'customer service officer': '43-4051.00',
    'telemarketer': '41-9041.00', 'kerani fail': '43-4071.00',
    # finance, business and law
    'akauntan': '13-2011.00', 'juruaudit': '13-2011.00', 'eksekutif akaun': '13-2011.00',
    'tax executive': '13-2082.00', 'eksekutif cukai': '13-2082.00', 'pegawai pinjaman': '13-2072.00',
    'juruwang bank': '43-3071.00', 'bank teller': '43-3071.00', 'pengurus kewangan': '11-3031.00',
    'peguam': '23-1011.00', 'peguam bela': '23-1011.00', 'peguam cara': '23-1011.00',
    'paralegal': '23-2011.00', 'pembantu guaman': '23-2011.00', 'juruukur bahan': '13-1051.00',
    'quantity surveyor': '13-1051.00', 'eksekutif sumber manusia': '13-1071.00',
    'pegawai sumber manusia': '13-1071.00', 'pengurus sumber manusia': '11-3121.00',
    'eksekutif pemasaran': '13-1161.00', 'pengurus pemasaran': '11-2021.00', 'pengurus jualan': '11-2022.00',
    'pengurus': '11-1021.00', 'pengurus besar': '11-1021.00', 'pengurus operasi': '11-1021.00',
    'perunding pengurusan': '13-1111.00', 'perancang acara': '13-1121.00', 'event planner': '13-1121.00',
    'eksekutif perhubungan awam': '27-3031.00', 'ejen hartanah': '41-9022.00', 'real estate negotiator': '41-9022.00',
    'ejen insurans': '41-3021.00', 'eksekutif jualan': '41-4012.00',
    # education
    'cikgu': '25-2021.00', 'guru': '25-2021.00', 'guru sekolah rendah': '25-2021.00',
    'guru sekolah menengah': '25-2031.00', 'guru tadika': '25-2011.00', 'cikgu tadika': '25-2011.00',
    'kindergarten teacher': '25-2011.00', 'preschool teacher': '25-2011.00', 'pensyarah': '25-1011.00',
    'tutor': '25-3041.00', 'guru tuisyen': '25-3041.00', 'tuition teacher': '25-3041.00',
    'kaunselor': '21-1012.00', 'kaunselor sekolah': '21-1012.00', 'pengasuh': '39-9011.00',
    'pengasuh kanak kanak': '39-9011.00', 'babysitter': '39-9011.00',
    # health
    'jururawat': '29-1141.00', 'staff nurse': '29-1141.00', 'jururawat terlatih': '29-1141.00',
    'jururawat masyarakat': '29-2061.00', 'pembantu jururawat': '31-1131.00', 'pembantu kesihatan': '31-1131.00',
    'doktor': '29-1215.00', 'doktor perubatan': '29-1215.00', 'pegawai perubatan': '29-1215.00',
    'medical officer': '29-1215.00', 'general practitioner': '29-1215.00', 'doktor gigi': '29-1021.00',
    'ahli farmasi': '29-1051.00', 'pembantu farmasi': '29-2052.00', 'pharmacy assistant': '29-2052.00',
    'penolong pegawai perubatan': '29-1071.00',
    'pembantu klinik': '31-9092.00', 'clinic assistant': '31-9092.00', 'ahli fisioterapi': '29-1123.00',
    'physiotherapist': '29-1123.00', 'juru x ray': '29-2034.00', 'juru radiografi': '29-2034.00',
    'radiographer': '29-2034.00', 'pakar pemakanan': '29-1031.00', 'dietitian': '29-1031.00',
    'doktor haiwan': '29-1131.00', 'jurupulih kesihatan gigi': '29-1292.00',
    # engineering, IT and science
    'jurutera awam': '17-2051.00', 'jurutera mekanikal': '17-2141.00', 'jurutera elektrik': '17-2071.00',
    'jurutera kimia': '17-2041.00', 'jurutera perisian': '15-1252.00', 'pembangun perisian': '15-1252.00',
    'pengaturcara': '15-1251.00', 'penganalisis data': '15-2051.01', 'penganalisis sistem': '15-1211.00',
    'pentadbir sistem': '15-1244.00', 'pentadbir rangkaian': '15-1244.00', 'system administrator': '15-1244.00',
    'it support': '15-1232.00', 'sokongan it': '15-1232.00', 'juruteknik it': '15-1232.00',
    'it officer': '15-1232.00', 'pengurus projek it': '15-1299.09', 'it project manager': '15-1299.09',
    'pereka web': '15-1254.00', 'arkitek': '17-1011.00', 'juruukur': '17-1022.00', 'juruukur tanah': '17-1022.00',
    'ahli kimia': '19-2031.00', 'pegawai keselamatan dan kesihatan pekerjaan': '19-5011.00',
    'safety officer': '19-5011.00', 'hse officer': '19-5011.00', 'pegawai keselamatan': '19-5011.00',
    'juruteknik': '49-9071.00', 'juruteknik penyelenggaraan': '49-9071.00', 'maintenance technician': '49-9071.00',
    'technician': '49-9071.00', 'juruteknik elektrik': '17-3023.00', 'juruteknik elektronik': '17-3023.00',
    'juruteknik penghawa dingin': '49-9021.00', 'aircond technician': '49-9021.00',
    # creative and media
    'pereka grafik': '27-1024.00', 'pereka dalaman': '27-1025.00', 'wartawan': '27-3023.00',
    'penulis': '27-3043.00', 'penulis kandungan': '27-3043.00', 'penterjemah': '27-3091.00',
    'jurubahasa': '27-3091.00', 'penyunting video': '27-4032.00', 'jurulatih': '27-2022.00',
    # sales and services
    'juruwang': '41-2011.00', 'jurujual': '41-2031.00', 'pembantu kedai': '41-2031.00',
    'pembantu jualan': '41-2031.00', 'shop assistant': '41-2031.00', 'promoter': '41-9011.00',
    'sales promoter': '41-9011.00', 'penyelia kedai': '41-1011.00', 'retail supervisor': '41-1011.00',
    'tukang masak': '35-2014.00', 'cook': '35-2014.00', 'cef': '35-1011.00', 'ketua tukang masak': '35-1011.00',
    'pelayan': '35-3031.00', 'pelayan restoran': '35-3031.00', 'waiter': '35-3031.00', 'waitress': '35-3031.00',
    'barista': '35-3023.01', 'pekerja dapur': '35-2021.00', 'kitchen helper': '35-2021.00',
    'pencuci pinggan': '35-9021.00', 'pembuat roti': '51-3011.00', 'tukang roti': '51-3011.00',
    'penjual daging': '51-3021.00', 'kerani hotel': '43-4081.00', 'penyambut tetamu hotel': '43-4081.00',
    'pengawal keselamatan': '33-9032.00', 'security guard': '33-9032.00', 'pengawal': '33-9032.00',
    'tukang cuci': '37-2011.00', 'pencuci': '37-2011.00', 'cleaner': '37-2011.00',
    'pembantu rumah': '37-2012.00', 'housekeeping': '37-2012.00', 'room attendant': '37-2012.00',
    'tukang kebun': '37-3011.00', 'pekebun': '37-3011.00', 'pendandan rambut': '39-5012.00',
    'tukang gunting rambut': '39-5012.00', 'hairstylist': '39-5012.00', 'jurusolek': '39-5094.00',
    'beautician': '39-5094.00', 'pramugari': '53-2031.00', 'pramugara': '53-2031.00', 'juruterbang': '53-2011.00',
    'pegawai polis': '33-3051.00', 'anggota polis': '33-3051.00', 'anggota bomba': '33-2011.00',
    'ahli bomba': '33-2011.00', 'pembantu kebajikan': '21-1093.00',
    # transport and logistics
    'pemandu lori': '53-3032.00', 'lorry driver': '53-3032.00', 'pemandu treler': '53-3032.00',
    'pemandu': '53-3033.00', 'pemandu van': '53-3033.00', 'van driver': '53-3033.00',
    'pemandu bas': '53-3052.00', 'bus driver': '53-3052.00', 'pemandu bas sekolah': '53-3051.00',
    'pemandu teksi': '53-3053.00', 'pemandu e hailing': '53-3053.00', 'e hailing driver': '53-3053.00',
    'grab driver': '53-3053.00', 'pemandu peribadi': '53-3053.00', 'chauffeur': '53-3053.00',
    'despatch': '43-5021.00', 'despatch rider': '43-5021.00', 'penghantar surat': '43-5021.00',
    'rider': '43-5021.00', 'delivery rider': '43-5021.00', 'penghantar makanan': '43-5021.00',
    'pemandu forklift': '53-7051.00', 'forklift driver': '53-7051.00', 'operator forklift': '53-7051.00',
    'general worker': '53-7062.00', 'pekerja am': '53-7062.00', 'pekerja gudang': '53-7062.00',
    'warehouse worker': '53-7062.00', 'pemandu ambulans': '53-3011.00',
    # production, trades and agriculture
    'operator pengeluaran': '51-2092.00', 'production operator': '51-2092.00', 'operator kilang': '51-2092.00',
    'operator': '51-2092.00', 'pemasang': '51-2092.00', 'penyelia pengeluaran': '51-1011.00',
    'production supervisor': '51-1011.00', 'pemeriksa kualiti': '51-9061.00', 'qc inspector': '51-9061.00',
    'quality inspector': '51-9061.00', 'mekanik': '49-3023.00', 'mekanik kereta': '49-3023.00',
    'juruelektrik': '47-2111.00', 'pendawai': '47-2111.00', 'pendawai elektrik': '47-2111.00',
    'tukang paip': '47-2152.00', 'tukang kayu': '47-2031.00', 'tukang cat': '47-2141.00',
    'tukang jahit': '51-6052.00', 'penjahit': '51-6052.00', 'tukang kimpal': '51-4121.00',
    'pengimpal': '51-4121.00', 'welder': '51-4121.00', 'buruh': '47-2061.00', 'buruh binaan': '47-2061.00',
    'pekerja binaan': '47-2061.00', 'construction worker': '47-2061.00', 'mandur': '47-1011.00',
    'penyelia tapak': '47-1011.00', 'site supervisor': '47-1011.00', 'pengurus pembinaan': '11-9021.00',
    'petani': '45-2092.00', 'pekerja ladang': '45-2092.00', 'penoreh getah': '45-2092.00',
    'nelayan': '45-3031.00',
}
