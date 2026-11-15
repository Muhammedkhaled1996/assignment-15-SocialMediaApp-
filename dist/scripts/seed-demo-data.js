"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const node_http_1 = __importDefault(require("node:http"));
const config_1 = require("../config");
const enum_1 = require("../common/enum");
const module_1 = require("../DB/module");
const accounting_1 = require("../modules/accounting");
const branches_1 = require("../modules/branches");
const notifications_1 = require("../modules/notifications");
const main_1 = __importDefault(require("../main"));
async function api(baseUrl, method, path, token, body, branchId) {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(branchId ? { "x-branch-id": branchId } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`API ${method} ${path} failed (${res.status}): ${JSON.stringify(json)}`);
    }
    return json.data;
}
async function seedDemoData() {
    console.log("🚀 Connecting to MongoDB:", config_1.DB_URI);
    await mongoose_1.default.connect(config_1.DB_URI, { serverSelectionTimeoutMS: 30000 });
    if (config_1.DB_URI.includes("localhost") || config_1.DB_URI.includes("127.0.0.1")) {
        for (const model of Object.values(mongoose_1.default.models)) {
            await model.collection.deleteMany({});
        }
        console.log("🧹 Cleared local collections for fresh demo seed");
    }
    for (const model of Object.values(mongoose_1.default.models)) {
        await model.createCollection().catch(() => { });
    }
    await accounting_1.accountingService.ensureChartOfAccounts();
    const { company, hqBranch } = await branches_1.branchService.ensureDefaultCompanyAndHQBranch();
    await module_1.SystemSettingModel.updateOne({ key: "DEFAULT_SAR_TO_EGP_RATE" }, {
        $setOnInsert: {
            key: "DEFAULT_SAR_TO_EGP_RATE",
            value: 13.5,
            category: "FINANCE",
            description: "سعر صرف الريال السعودي الاسترشادي مقابل الجنيه",
        },
    }, { upsert: true });
    let superAdmin = await module_1.UserModel.findOne({ email: "admin@troziana.com" });
    if (superAdmin && (!superAdmin.confirmEmail || !superAdmin.password?.startsWith("$argon2"))) {
        await module_1.UserModel.collection.deleteOne({ _id: superAdmin._id });
        superAdmin = null;
    }
    if (!superAdmin) {
        await module_1.UserModel.collection.deleteOne({ email: "admin@troziana.com" });
        superAdmin = await module_1.UserModel.create({
            firstName: "محمد",
            lastName: "خالد",
            userName: "محمد خالد",
            email: "admin@troziana.com",
            password: "Password123!",
            phone: "01000000001",
            roleNumber: enum_1.UserRole.SUPER_ADMIN,
            branchId: hqBranch._id,
            primaryBranchId: hqBranch._id,
            assignedBranchIds: [hqBranch._id],
            canAccessAllBranches: true,
            isActive: true,
            accountStatus: enum_1.UserAccountStatus.ACTIVE,
            confirmEmail: new Date(),
            employeeCode: "EMP-HQ-001",
        });
    }
    const server = node_http_1.default.createServer(main_1.default);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    try {
        const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@troziana.com", password: "Password123!" }),
        });
        const loginJson = await loginRes.json();
        if (!loginRes.ok) {
            throw new Error(`Login failed: ${JSON.stringify(loginJson)}`);
        }
        const token = loginJson.data.access_token;
        console.log("✅ Logged in as Super Admin (admin@troziana.com)");
        await api(baseUrl, "PATCH", "/api/v1/settings/company", token, {
            nameAr: "شركة تروزيانا للسياحة والسفر",
            nameEn: "Troziana Travel & Tourism",
            logoUrl: "https://placehold.co/240x80/0F172A/D97706?text=TROZIANA",
            primaryColor: "#0F172A",
            secondaryColor: "#D97706",
            tourismLicenseNumber: "LIC-EG-2026-884",
            taxNumber: "312-889-400",
            commercialRegister: "CR-104920",
            phone: "0224159000",
            email: "info@troziana.com",
            address: "15 شارع الميرغني، مصر الجديدة، القاهرة",
            website: "https://troziana.com",
            supportedTourismTypes: ["DOMESTIC", "RELIGIOUS", "OUTBOUND"],
        });
        console.log("✅ Updated Company Profile & Branding");
        const alexBranch = (await module_1.BranchModel.findOne({ code: "BR-ALX" }).lean()) ||
            (await api(baseUrl, "POST", "/api/v1/branches", token, {
                code: "BR-ALX",
                nameAr: "فرع الإسكندرية - سموحة",
                nameEn: "Alexandria Branch - Smouha",
                governorate: "Alexandria",
                city: "Alexandria",
                address: "45 شارع فوزي معاذ، سموحة",
                phone: "034255667",
                email: "alex@troziana.com",
                isHeadquarters: false,
            }));
        const mansouraBranch = (await module_1.BranchModel.findOne({ code: "BR-MAN" }).lean()) ||
            (await api(baseUrl, "POST", "/api/v1/branches", token, {
                code: "BR-MAN",
                nameAr: "فرع المنصورة",
                nameEn: "Mansoura Branch",
                governorate: "Dakahlia",
                city: "Mansoura",
                address: "شارع الجمهورية أمام الجامعة",
                phone: "0502345678",
                email: "mansoura@troziana.com",
                isHeadquarters: false,
            }));
        console.log("✅ Created Branches (HQ-CAI, BR-ALX, BR-MAN)");
        const staffSpecs = [
            {
                firstName: "أحمد",
                lastName: "المنصور",
                email: "gm@troziana.com",
                phone: "01000000002",
                roleNumber: enum_1.UserRole.ADMIN,
                branchId: hqBranch._id.toString(),
                canAccessAllBranches: true,
                employeeCode: "EMP-HQ-002",
            },
            {
                firstName: "كريم",
                lastName: "القاهري",
                email: "cairo.mgr@troziana.com",
                phone: "01000000003",
                roleNumber: enum_1.UserRole.BRANCH_MANAGER,
                branchId: hqBranch._id.toString(),
                canAccessAllBranches: false,
                employeeCode: "EMP-CAI-003",
            },
            {
                firstName: "هشام",
                lastName: "السكندري",
                email: "alex.mgr@troziana.com",
                phone: "01000000004",
                roleNumber: enum_1.UserRole.BRANCH_MANAGER,
                branchId: alexBranch._id.toString(),
                canAccessAllBranches: false,
                employeeCode: "EMP-ALX-004",
            },
            {
                firstName: "سارة",
                lastName: "المالكي",
                email: "accountant@troziana.com",
                phone: "01000000005",
                roleNumber: enum_1.UserRole.ACCOUNTANT,
                branchId: hqBranch._id.toString(),
                canAccessAllBranches: true,
                employeeCode: "EMP-FIN-005",
            },
            {
                firstName: "عمر",
                lastName: "المبيعات",
                email: "sales@troziana.com",
                phone: "01000000006",
                roleNumber: enum_1.UserRole.SALES,
                branchId: hqBranch._id.toString(),
                canAccessAllBranches: false,
                employeeCode: "EMP-SLS-006",
            },
            {
                firstName: "طارق",
                lastName: "التعاقدات",
                email: "procurement@troziana.com",
                phone: "01000000007",
                roleNumber: enum_1.UserRole.PROCUREMENT,
                branchId: hqBranch._id.toString(),
                canAccessAllBranches: true,
                employeeCode: "EMP-PRC-007",
            },
            {
                firstName: "ياسر",
                lastName: "العمليات",
                email: "operations@troziana.com",
                phone: "01000000008",
                roleNumber: enum_1.UserRole.OPERATIONS,
                branchId: hqBranch._id.toString(),
                canAccessAllBranches: true,
                employeeCode: "EMP-OPS-008",
            },
            {
                firstName: "منى",
                lastName: "الشباك",
                email: "employee@troziana.com",
                phone: "01000000009",
                roleNumber: enum_1.UserRole.EMPLOYEE,
                branchId: alexBranch._id.toString(),
                canAccessAllBranches: false,
                employeeCode: "EMP-ALX-009",
            },
        ];
        for (const s of staffSpecs) {
            const exists = await module_1.UserModel.findOne({ email: s.email });
            if (!exists) {
                await api(baseUrl, "POST", "/api/v1/users", token, {
                    ...s,
                    password: "Password123!",
                });
            }
        }
        console.log("✅ Created Staff Users (Roles 1..8)");
        const supSaudi = await api(baseUrl, "POST", "/api/v1/suppliers", token, {
            code: "SUP-SAU-01",
            nameAr: "مجموعة الخطوط السعودية والفنادق",
            nameEn: "Saudi Airlines & Haramain Hotels Group",
            type: "HOTEL",
            currency: "SAR",
            contactPerson: "أ. فهد القحطاني",
            phone: "+966501234567",
            email: "fahd@saudihotels.sa",
            paymentTerms: "سداد خلال 14 يوماً قبل التسكين",
        });
        const supEgypt = await api(baseUrl, "POST", "/api/v1/suppliers", token, {
            code: "SUP-EGY-01",
            nameAr: "مجموعة منتجعات البحر الأحمر والنقل السياحي",
            nameEn: "Red Sea Resorts & Tourist Transport Co.",
            type: "HOTEL",
            currency: "EGP",
            contactPerson: "م. شريف عبد الرحمن",
            phone: "01022334455",
            email: "contracts@redsearesorts.eg",
            paymentTerms: "50% دفعة مقدمة و50% عند الوصول",
        });
        const supTurkey = await api(baseUrl, "POST", "/api/v1/suppliers", token, {
            code: "SUP-TRK-01",
            nameAr: "شركة البوسفور للسياحة والضيافة",
            nameEn: "Bosphorus Hospitality & Land Operator",
            type: "OTHER",
            currency: "USD",
            contactPerson: "أ. كريم يلماز",
            phone: "+905321234567",
            email: "b2b@bosphorustours.tr",
            paymentTerms: "سداد كامل قبل السفر بـ 10 أيام",
        });
        console.log("✅ Created 3 Suppliers (SAR, EGP, USD)");
        const flightUmrah = await api(baseUrl, "POST", "/api/v1/flights", token, {
            contractReference: "FLT-SV-301",
            airline: "Saudia Airlines",
            airlineCode: "SV",
            flightNumberOutbound: "SV301",
            flightNumberReturn: "SV302",
            supplierId: supSaudi._id,
            purchaseSource: "DIRECT",
            flightRoute: "CAI-JED / MED-CAI",
            departureAirport: "CAI",
            arrivalAirport: "JED",
            returnDepartureAirport: "MED",
            returnArrivalAirport: "CAI",
            departureDate: "2027-01-10T08:00:00.000Z",
            returnDate: "2027-01-20T18:00:00.000Z",
            seatQuantity: 40,
            currency: "EGP",
            unitCost: 13500,
            exchangeRateToEgp: 1,
            notes: "بلوك طيران مباشر القاهرة - جدة والعودة المدينة - القاهرة",
        });
        const flightIstanbul = await api(baseUrl, "POST", "/api/v1/flights", token, {
            contractReference: "FLT-TK-691",
            airline: "Turkish Airlines",
            airlineCode: "TK",
            flightNumberOutbound: "TK691",
            flightNumberReturn: "TK692",
            supplierId: supTurkey._id,
            purchaseSource: "DIRECT",
            flightRoute: "CAI-IST / IST-CAI",
            departureAirport: "CAI",
            arrivalAirport: "IST",
            returnDepartureAirport: "IST",
            returnArrivalAirport: "CAI",
            departureDate: "2027-02-05T10:00:00.000Z",
            returnDate: "2027-02-10T22:00:00.000Z",
            seatQuantity: 30,
            currency: "USD",
            unitCost: 350,
            exchangeRateToEgp: 50,
            notes: "تذاكر مجموعة القاهرة - إسطنبول شاملة حقيبة 30 كجم",
        });
        console.log("✅ Created 2 Flight Lots");
        const hotelMakkah = await api(baseUrl, "POST", "/api/v1/hotels", token, {
            nameAr: "فندق دار التوحيد إنتركونتيننتال مكة",
            nameEn: "Dar Al Tawhid InterContinental Makkah",
            city: "MAKKAH",
            country: "SA",
            stars: 5,
            distanceToHaramMeters: 50,
            address: "ساحة الحرم المكي، طريق إبراهيم الخليل",
        });
        const hotelMadinah = await api(baseUrl, "POST", "/api/v1/hotels", token, {
            nameAr: "فندق أنوار المدينة موفنبيك",
            nameEn: "Anwar Al Madinah Movenpick",
            city: "MADINAH",
            country: "SA",
            stars: 5,
            distanceToHaramMeters: 100,
            address: "المنطقة المركزية الشمالية، المدينة المنورة",
        });
        const hotelSharm = await api(baseUrl, "POST", "/api/v1/hotels", token, {
            nameAr: "منتجع ريكسوس شرم الشيخ",
            nameEn: "Rixos Sharm El Sheikh Resort",
            city: "SHARM_EL_SHEIKH",
            country: "EG",
            stars: 5,
            address: "خليج نبق، شرم الشيخ، جنوب سيناء",
        });
        const hotelIstanbul = await api(baseUrl, "POST", "/api/v1/hotels", token, {
            nameAr: "فندق سويس أوتيل البوسفور إسطنبول",
            nameEn: "Swissotel The Bosphorus Istanbul",
            city: "ISTANBUL",
            country: "TR",
            stars: 5,
            address: "بشكتاش، إسطنبول، تركيا",
        });
        const contractMakkah = await api(baseUrl, "POST", "/api/v1/hotels/contracts", token, {
            hotelId: hotelMakkah._id,
            supplierId: supSaudi._id,
            city: "MAKKAH",
            checkIn: "2027-01-10T00:00:00.000Z",
            checkOut: "2027-01-15T00:00:00.000Z",
            nights: 5,
            roomCapacities: { doubleRooms: 2, tripleRooms: 2, quadRooms: 8 },
            pricingMode: "FLAT_RATE",
            currency: "SAR",
            rates: { flatRoomRatePerNight: 800 },
            exchangeRateToEgp: 13.5,
            dueDate: "2026-12-25T00:00:00.000Z",
        });
        const contractMadinah = await api(baseUrl, "POST", "/api/v1/hotels/contracts", token, {
            hotelId: hotelMadinah._id,
            supplierId: supSaudi._id,
            city: "MADINAH",
            checkIn: "2027-01-15T00:00:00.000Z",
            checkOut: "2027-01-20T00:00:00.000Z",
            nights: 5,
            roomCapacities: { doubleRooms: 2, tripleRooms: 2, quadRooms: 8 },
            pricingMode: "TIERED_RATE",
            currency: "SAR",
            rates: {
                doubleRoomRatePerNight: 450,
                tripleRoomRatePerNight: 550,
                quadRoomRatePerNight: 650,
            },
            exchangeRateToEgp: 13.5,
            dueDate: "2026-12-28T00:00:00.000Z",
        });
        const contractSharm = await api(baseUrl, "POST", "/api/v1/hotels/contracts", token, {
            hotelId: hotelSharm._id,
            supplierId: supEgypt._id,
            city: "SHARM_EL_SHEIKH",
            checkIn: "2026-12-15T00:00:00.000Z",
            checkOut: "2026-12-18T00:00:00.000Z",
            nights: 3,
            roomCapacities: { singleRooms: 3, doubleRooms: 10, tripleRooms: 6, quadRooms: 2 },
            pricingMode: "TIERED_RATE",
            currency: "EGP",
            rates: {
                singleRoomRatePerNight: 3500,
                doubleRoomRatePerNight: 4800,
                tripleRoomRatePerNight: 6000,
                quadRoomRatePerNight: 7000,
            },
            exchangeRateToEgp: 1,
            dueDate: "2026-12-10T00:00:00.000Z",
        });
        const contractIstanbul = await api(baseUrl, "POST", "/api/v1/hotels/contracts", token, {
            hotelId: hotelIstanbul._id,
            supplierId: supTurkey._id,
            city: "ISTANBUL",
            checkIn: "2027-02-05T00:00:00.000Z",
            checkOut: "2027-02-10T00:00:00.000Z",
            nights: 5,
            roomCapacities: { singleRooms: 2, doubleRooms: 10, tripleRooms: 4, quadRooms: 0 },
            pricingMode: "TIERED_RATE",
            currency: "USD",
            rates: {
                singleRoomRatePerNight: 120,
                doubleRoomRatePerNight: 160,
                tripleRoomRatePerNight: 210,
            },
            exchangeRateToEgp: 50,
            dueDate: "2027-01-25T00:00:00.000Z",
        });
        console.log("✅ Created 4 Hotels & 4 Hotel Contracts");
        const pricingUmrah = await api(baseUrl, "POST", "/api/v1/pricing", token, {
            code: "PRC-UMRAH-1448",
            name: "تسعير عمرة رجب المميزة - 1448هـ",
            exchangeRateSarToEgp: 13.5,
            groupCapacity: 40,
            inputs: {
                flightCostPerSeatEgp: 13500,
                makkahHotelPerPersonStaySar: { single: 4000, double: 2000, triple: 1333.33, quad: 1000 },
                madinahHotelPerPersonStaySar: { single: 2000, double: 1000, triple: 800, quad: 600 },
                saudiAgentFeeSar: 500,
                transportCostSar: 300,
                barcodeFeeEgp: 3200,
                giftsCostEgp: 300,
                otherOperationalCostEgp: 500,
                supervisorFlightTicketEgp: 13500,
                supervisorAccommodationSar: 1600,
                supervisorGratuitiesEgp: 4900,
                targetProfitMarginPercent: 15,
                maxDiscountPercentAllowed: 5,
            },
        });
        await api(baseUrl, "PATCH", `/api/v1/pricing/${pricingUmrah._id}/approve`, token);
        const pricingSharm = await api(baseUrl, "POST", "/api/v1/pricing", token, {
            code: "PRC-SHARM-2026",
            name: "تسعير برنامج شرم الشيخ وسفاري دهب - 4 أيام",
            exchangeRateSarToEgp: 1,
            groupCapacity: 45,
            inputs: {
                flightCostPerSeatEgp: 1200,
                hotelPerPersonStayCost: { single: 10500, double: 7200, triple: 6000, quad: 5250 },
                otherOperationalCostEgp: 600,
                supervisorFlightTicketEgp: 1200,
                supervisorAccommodationSar: 7200,
                supervisorGratuitiesEgp: 1500,
                targetProfitMarginPercent: 20,
                maxDiscountPercentAllowed: 8,
            },
        });
        await api(baseUrl, "PATCH", `/api/v1/pricing/${pricingSharm._id}/approve`, token);
        const pricingIstanbul = await api(baseUrl, "POST", "/api/v1/pricing", token, {
            code: "PRC-ISTANBUL-2026",
            name: "تسعير برنامج إسطنبول وبورصة - 6 أيام",
            exchangeRateSarToEgp: 50,
            groupCapacity: 30,
            inputs: {
                flightCostPerSeatEgp: 17500,
                hotelPerPersonStayCost: { single: 600, double: 400, triple: 350, quad: 300 },
                transportCostSar: 60,
                otherOperationalCostEgp: 1500,
                supervisorFlightTicketEgp: 17500,
                supervisorAccommodationSar: 400,
                supervisorGratuitiesEgp: 3000,
                targetProfitMarginPercent: 18,
                maxDiscountPercentAllowed: 5,
            },
        });
        await api(baseUrl, "PATCH", `/api/v1/pricing/${pricingIstanbul._id}/approve`, token);
        console.log("✅ Created & Approved 3 Pricing Versions");
        const tripUmrah = await api(baseUrl, "POST", "/api/v1/trips", token, {
            code: "TRP-UMR-001",
            nameAr: "رحلة عمرة رجب المميزة - 10 أيام",
            nameEn: "Rajab VIP Umrah Trip - 10 Days",
            tripCategory: "RELIGIOUS",
            transportType: "FLIGHT",
            season: "1448H-RAJAB",
            destination: "MAKKAH_MADINAH",
            coverImage: "https://placehold.co/800x500/0F172A/F59E0B?text=Umrah+Rajab+VIP",
            galleryImages: [
                "https://placehold.co/800x500/1E293B/F59E0B?text=Makkah+Haram",
                "https://placehold.co/800x500/1E293B/F59E0B?text=Madinah+Nabawi",
            ],
            itinerary: [
                {
                    dayNumber: 1,
                    titleAr: "السفر إلى جدة والتوجه لمكة المكرمة",
                    descriptionAr: "التجمع بمطار القاهرة، السفر على الخطوط السعودية، الوصول والتسكين بفندق دار التوحيد وأداء مناسك العمرة.",
                    meals: ["عشاء"],
                    activities: ["طيران مباشر", "أداء العمرة"],
                },
                {
                    dayNumber: 5,
                    titleAr: "مزارات مكة المكرمة والانتقال للمدينة",
                    descriptionAr: "زيارة جبل النور وعرفات ثم التحرك بقطار الحرمين إلى المدينة المنورة والتسكين بفندق أنوار المدينة.",
                    meals: ["إفطار", "عشاء"],
                    activities: ["مزارات مكة", "قطار الحرمين"],
                },
            ],
            departureDate: "2027-01-10T08:00:00.000Z",
            returnDate: "2027-01-20T18:00:00.000Z",
            flightAllocations: [{ flightLotId: flightUmrah._id, allocatedSeats: 40 }],
            hotelAllocations: [
                { hotelContractId: contractMakkah._id, city: "MAKKAH", doubleRooms: 2, tripleRooms: 2, quadRooms: 8 },
                { hotelContractId: contractMadinah._id, city: "MADINAH", doubleRooms: 2, tripleRooms: 2, quadRooms: 8 },
            ],
            capacity: 40,
            approvedPricingVersionId: pricingUmrah._id,
            quotaMode: "ALLOCATED_QUOTA",
            includedServices: ["تأشيرة العمرة والباركود", "تذاكر الطيران السعودي", "فنادق 5 نجوم بالصف الأول", "الانتقالات بقطار الحرمين"],
            requiredDocuments: ["جواز سفر صالح 6 أشهر", "الرقم القومي", "2 صورة شخصية"],
            status: "OPEN_FOR_BOOKING",
        });
        const tripSharm = await api(baseUrl, "POST", "/api/v1/trips", token, {
            code: "TRP-DOM-002",
            nameAr: "شرم الشيخ وسفاري دهب - 4 أيام / 3 ليالي",
            nameEn: "Sharm El Sheikh & Dahab Safari - 4 Days",
            tripCategory: "DOMESTIC",
            transportType: "BUS",
            season: "WINTER-2026",
            destination: "SHARM_EL_SHEIKH",
            coverImage: "https://placehold.co/800x500/0369A1/FDE047?text=Sharm+El+Sheikh+Resort",
            galleryImages: [
                "https://placehold.co/800x500/0284C7/FFFFFF?text=Rixos+Beach",
                "https://placehold.co/800x500/B45309/FFFFFF?text=Dahab+Safari",
            ],
            itinerary: [
                {
                    dayNumber: 1,
                    titleAr: "التحرك والتسكين بمنتجع ريكسوس",
                    descriptionAr: "التحرك بالأتوبيس السياحي المكيف من القاهرة، الوصول والتسكين والاستمتاع بالشاطئ والألعاب المائية.",
                    meals: ["غداء", "عشاء"],
                    activities: ["استقبال", "أكوا بارك"],
                },
                {
                    dayNumber: 2,
                    titleAr: "رحلة سفاري دهب والبلو هول",
                    descriptionAr: "رحلة سفاري بيتش باجي في صحراء سيناء وزيارة محمية البلو هول بدهب وعشاء بدوي.",
                    meals: ["إفطار", "غداء", "عشاء بدوي"],
                    activities: ["سفاري", "سنوركلينج"],
                },
            ],
            departureDate: "2026-12-15T06:00:00.000Z",
            returnDate: "2026-12-18T22:00:00.000Z",
            hotelAllocations: [
                { hotelContractId: contractSharm._id, city: "SHARM_EL_SHEIKH", singleRooms: 3, doubleRooms: 10, tripleRooms: 6, quadRooms: 2 },
            ],
            capacity: 45,
            approvedPricingVersionId: pricingSharm._id,
            quotaMode: "SHARED_QUOTA",
            includedServices: ["إقامة فندقية شاملة جميع الوجبات والمشروبات", "الانتقالات ذهاب وعودة", "رحلة سفاري مجانية", "مشرف سياحي"],
            requiredDocuments: ["صورة البطاقة الشخصية", "شهادات ميلاد الأطفال", "قسيمة الزواج"],
            status: "OPEN_FOR_BOOKING",
        });
        const tripIstanbul = await api(baseUrl, "POST", "/api/v1/trips", token, {
            code: "TRP-OUT-003",
            nameAr: "إسطنبول وجزيرة الأميرات وبورصة - 6 أيام",
            nameEn: "Istanbul, Princes Islands & Bursa - 6 Days",
            tripCategory: "OUTBOUND",
            transportType: "FLIGHT",
            season: "WINTER-2027",
            destination: "ISTANBUL",
            coverImage: "https://placehold.co/800x500/7C2D12/FDE68A?text=Istanbul+Bosphorus",
            galleryImages: [
                "https://placehold.co/800x500/9A3412/FFFFFF?text=Bosphorus+Cruise",
                "https://placehold.co/800x500/1E3A8A/FFFFFF?text=Bursa+Cable+Car",
            ],
            itinerary: [
                {
                    dayNumber: 1,
                    titleAr: "الوصول إلى إسطنبول وجولة البوسفور",
                    descriptionAr: "الاستقبال بمطار إسطنبول، التسكين بفندق سويس أوتيل، ثم رحلة بحرية مسائية في مضيق البوسفور.",
                    meals: ["عشاء"],
                    activities: ["رحلة البوسفور"],
                },
                {
                    dayNumber: 3,
                    titleAr: "رحلة مدينة بورصة الخضراء والتلفريك",
                    descriptionAr: "زيارة جبل أولوداغ بالتلفريك والجامع الكبير وسوق الحرير.",
                    meals: ["إفطار", "غداء"],
                    activities: ["التلفريك", "جولة تسوق"],
                },
            ],
            departureDate: "2027-02-05T10:00:00.000Z",
            returnDate: "2027-02-10T22:00:00.000Z",
            flightAllocations: [{ flightLotId: flightIstanbul._id, allocatedSeats: 30 }],
            hotelAllocations: [
                { hotelContractId: contractIstanbul._id, city: "ISTANBUL", singleRooms: 2, doubleRooms: 10, tripleRooms: 4, quadRooms: 0 },
            ],
            capacity: 30,
            approvedPricingVersionId: pricingIstanbul._id,
            quotaMode: "SHARED_QUOTA",
            includedServices: ["تذاكر الطيران التركي", "إقامة 5 نجوم بالإفطار", "رحلة البوسفور", "انتقالات المطار"],
            requiredDocuments: ["جواز سفر صالح 6 أشهر", "تأشيرة تركيا", "2 صورة شخصية"],
            status: "OPEN_FOR_BOOKING",
        });
        console.log("✅ Created 3 Trips (RELIGIOUS, DOMESTIC, OUTBOUND)");
        const groupA = await api(baseUrl, "POST", "/api/v1/trips/groups", token, {
            code: "GRP-UMR-A",
            nameAr: "الفوج الأول - القاهرة والإسكندرية",
            nameEn: "Group A - Cairo & Alex",
            tripId: tripUmrah._id,
            supervisorName: "الشيخ طارق منصور",
            supervisorPhone: "01099887766",
            capacity: 40,
        });
        await api(baseUrl, "POST", "/api/v1/quotas/allocate", token, {
            tripId: tripUmrah._id,
            branchId: hqBranch._id.toString(),
            quantity: 15,
            notes: "حصة الفرع الرئيسي بالقاهرة",
        });
        await api(baseUrl, "POST", "/api/v1/quotas/allocate", token, {
            tripId: tripUmrah._id,
            branchId: alexBranch._id.toString(),
            quantity: 10,
            notes: "حصة فرع الإسكندرية",
        });
        console.log("✅ Allocated Branch Quotas for Umrah Trip");
        const partnerNile = await api(baseUrl, "POST", "/api/v1/wholesale/partners", token, {
            code: "AGN-NILE-01",
            companyNameAr: "شركة النيل للسياحة الدينية",
            companyNameEn: "Nile Religious Tourism Co.",
            tourismLicenseNumber: "LIC-2244",
            taxNumber: "412-889-100",
            contactPerson: "حسام الدين مصطفى",
            phone: "01223344556",
            email: "b2b@niletourism.com",
            address: "وسط البلد، القاهرة",
        });
        const wholesaleContract = await api(baseUrl, "POST", "/api/v1/wholesale/contracts", token, {
            partnerId: partnerNile._id,
            tripId: tripUmrah._id,
            branchId: hqBranch._id.toString(),
            allocationType: "SEAT_BLOCK",
            seatQuantity: 5,
            unitPriceEgp: 56000,
            depositAmountEgp: 100000,
            notes: "عقد جملة 5 مقاعد غرفة رباعية - عمرة رجب",
        });
        console.log("✅ Created B2B Wholesale Partner & Contract");
        const pax1 = await api(baseUrl, "POST", "/api/v1/passengers", token, {
            branchId: hqBranch._id.toString(),
            arabicName: "محمد أحمد علي حسن",
            englishName: "MOHAMED AHMED ALI HASSAN",
            nationalId: "28505150101234",
            phone: "01012345678",
            occupation: "مهندس مدني",
            passportNumber: "A99887761",
            passportIssueDate: "2024-01-01",
            passportExpirationDate: "2030-01-01",
            familyGroupCode: "FAM-CAI-01",
        });
        const pax2 = await api(baseUrl, "POST", "/api/v1/passengers", token, {
            branchId: hqBranch._id.toString(),
            arabicName: "فاطمة محمود السيد",
            englishName: "FATMA MAHMOUD ELSAYED",
            nationalId: "29008200102468",
            phone: "01012345679",
            occupation: "طبيبة",
            passportNumber: "A99887762",
            passportIssueDate: "2024-03-01",
            passportExpirationDate: "2030-03-01",
            mahramPassengerId: pax1._id,
            mahramRelationship: "زوجة",
            familyGroupCode: "FAM-CAI-01",
        });
        const pax3 = await api(baseUrl, "POST", "/api/v1/passengers", token, {
            branchId: alexBranch._id.toString(),
            arabicName: "خالد إبراهيم عبد العزيز",
            englishName: "KHALED IBRAHIM ABDELAZIZ",
            nationalId: "27811100201357",
            phone: "01222334455",
            occupation: "محاسب قانوني",
            passportNumber: "A99887763",
            passportIssueDate: "2023-06-15",
            passportExpirationDate: "2029-06-15",
            familyGroupCode: "FAM-ALX-01",
        });
        const pax4 = await api(baseUrl, "POST", "/api/v1/passengers", token, {
            branchId: hqBranch._id.toString(),
            arabicName: "نورهان طارق مصطفى",
            englishName: "NOURHAN TAREK MOSTAFA",
            nationalId: "29502120102244",
            phone: "01112223344",
            occupation: "مصممة جرافيك",
            passportNumber: "A99887764",
            passportIssueDate: "2024-05-01",
            passportExpirationDate: "2030-05-01",
        });
        const pax5 = await api(baseUrl, "POST", "/api/v1/passengers", token, {
            branchId: hqBranch._id.toString(),
            arabicName: "يوسف سامح عبد الله",
            englishName: "YOUSSEF SAMEH ABDALLAH",
            nationalId: "29207042101119",
            phone: "01066554433",
            occupation: "مدير مبيعات",
            familyGroupCode: "FAM-SHM-01",
        });
        const pax6 = await api(baseUrl, "POST", "/api/v1/passengers", token, {
            branchId: alexBranch._id.toString(),
            arabicName: "مريم عادل فؤاد",
            englishName: "MARIAM ADEL FOUAD",
            nationalId: "29609180202288",
            phone: "01555667788",
            occupation: "صيدلانية",
        });
        console.log("✅ Created 6 Passengers (4 with Passports, 2 Domestic without Passports)");
        const bk1 = await api(baseUrl, "POST", "/api/v1/bookings", token, {
            tripId: tripUmrah._id,
            groupId: groupA._id,
            passengerId: pax1._id,
            branchId: hqBranch._id.toString(),
            roomType: "QUAD",
            discountAmount: 1000,
            status: "ON_HOLD",
            familyGroupCode: "FAM-CAI-01",
            notes: "حجز عائلي فرع القاهرة",
        });
        await api(baseUrl, "POST", `/api/v1/bookings/${bk1._id}/confirm`, token);
        const bk2 = await api(baseUrl, "POST", "/api/v1/bookings", token, {
            tripId: tripUmrah._id,
            groupId: groupA._id,
            passengerId: pax2._id,
            branchId: hqBranch._id.toString(),
            roomType: "QUAD",
            discountAmount: 500,
            status: "ON_HOLD",
            mahramPassengerId: pax1._id,
            familyGroupCode: "FAM-CAI-01",
        });
        await api(baseUrl, "POST", `/api/v1/bookings/${bk2._id}/confirm`, token);
        const bk3 = await api(baseUrl, "POST", "/api/v1/bookings", token, {
            tripId: tripUmrah._id,
            groupId: groupA._id,
            passengerId: pax3._id,
            branchId: alexBranch._id.toString(),
            roomType: "DOUBLE",
            discountAmount: 0,
            status: "ON_HOLD",
            familyGroupCode: "FAM-ALX-01",
        });
        const bk4 = await api(baseUrl, "POST", "/api/v1/bookings", token, {
            tripId: tripSharm._id,
            passengerId: pax5._id,
            branchId: hqBranch._id.toString(),
            roomType: "DOUBLE",
            discountAmount: 200,
            status: "ON_HOLD",
            familyGroupCode: "FAM-SHM-01",
            notes: "رحلة داخلية بالرقم القومي فقط",
        });
        await api(baseUrl, "POST", `/api/v1/bookings/${bk4._id}/confirm`, token);
        const bk5 = await api(baseUrl, "POST", "/api/v1/bookings", token, {
            tripId: tripSharm._id,
            passengerId: pax6._id,
            branchId: alexBranch._id.toString(),
            roomType: "SINGLE",
            discountAmount: 0,
            status: "ON_HOLD",
            notes: "غرفة فردية في شرم الشيخ",
        });
        await api(baseUrl, "POST", `/api/v1/bookings/${bk5._id}/confirm`, token);
        const bk6 = await api(baseUrl, "POST", "/api/v1/bookings", token, {
            tripId: tripIstanbul._id,
            passengerId: pax4._id,
            branchId: hqBranch._id.toString(),
            roomType: "TRIPLE",
            discountAmount: 500,
            status: "ON_HOLD",
            notes: "حجز إسطنبول - بانتظار سداد باقي الدفعة",
        });
        console.log("✅ Created 6 Bookings across Umrah, Sharm & Istanbul");
        const cbCairoEgp = await api(baseUrl, "POST", "/api/v1/cashboxes", token, {
            code: "CB-CAI-EGP-01",
            nameAr: "خزينة فرع القاهرة الرئيسية - جنيه",
            nameEn: "Cairo HQ EGP Cashbox",
            branchId: hqBranch._id.toString(),
            isMainCashbox: true,
            currency: "EGP",
            openingBalance: 250000,
        });
        const cbAlexEgp = await api(baseUrl, "POST", "/api/v1/cashboxes", token, {
            code: "CB-ALX-EGP-01",
            nameAr: "خزينة فرع الإسكندرية - جنيه",
            nameEn: "Alexandria EGP Cashbox",
            branchId: alexBranch._id.toString(),
            isMainCashbox: false,
            currency: "EGP",
            openingBalance: 100000,
        });
        const cbMansouraEgp = await api(baseUrl, "POST", "/api/v1/cashboxes", token, {
            code: "CB-MAN-EGP-01",
            nameAr: "خزينة فرع المنصورة - جنيه",
            nameEn: "Mansoura EGP Cashbox",
            branchId: mansouraBranch._id.toString(),
            isMainCashbox: false,
            currency: "EGP",
            openingBalance: 50000,
        });
        const cbCairoSar = await api(baseUrl, "POST", "/api/v1/cashboxes", token, {
            code: "CB-CAI-SAR-01",
            nameAr: "خزينة الريال السعودي - المركز الرئيسي",
            nameEn: "Cairo HQ SAR Cashbox",
            branchId: hqBranch._id.toString(),
            isMainCashbox: false,
            currency: "SAR",
            openingBalance: 50000,
            exchangeRateToEgp: 13.5,
        });
        console.log("✅ Created 4 Cashboxes");
        await api(baseUrl, "POST", "/api/v1/receipts", token, {
            bookingId: bk1._id,
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoEgp._id,
            amount: 50000,
            paymentMethod: "CASH",
            notes: "سداد دفعة أولى حجز عمرة رجب",
        });
        await api(baseUrl, "POST", "/api/v1/receipts", token, {
            bookingId: bk2._id,
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoEgp._id,
            amount: 58000,
            paymentMethod: "BANK_TRANSFER",
            referenceCode: "BNK-998811",
            notes: "سداد قيمة حجز العمرة بالكامل تقريباً",
        });
        await api(baseUrl, "POST", "/api/v1/receipts", token, {
            bookingId: bk4._id,
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoEgp._id,
            amount: 10000,
            paymentMethod: "POS_CARD",
            referenceCode: "POS-441122",
            notes: "سداد كامل رحلة شرم الشيخ",
        });
        await api(baseUrl, "POST", "/api/v1/receipts", token, {
            bookingId: bk5._id,
            branchId: alexBranch._id.toString(),
            cashboxId: cbAlexEgp._id,
            amount: 15000,
            paymentMethod: "CASH",
            notes: "سداد حجز غرفة فردية شرم الشيخ - فرع الإسكندرية",
        });
        await api(baseUrl, "POST", "/api/v1/receipts", token, {
            wholesaleContractId: wholesaleContract._id,
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoEgp._id,
            amount: 100000,
            paymentMethod: "BANK_TRANSFER",
            referenceCode: "WSL-TRF-01",
            notes: "دفعة مقدمة لعقد جملة شركة النيل",
        });
        await api(baseUrl, "POST", "/api/v1/receipts/refund", token, {
            bookingId: bk1._id,
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoEgp._id,
            amount: 5000,
            paymentMethod: "CASH",
            notes: "رد فرق تسوية غرفة",
        });
        console.log("✅ Created Customer & Wholesale Receipts + Refund Voucher");
        await api(baseUrl, "POST", "/api/v1/expenses", token, {
            expenseType: "OPERATIONAL_EXPENSE",
            category: "شنط وهدايا المعتمرين",
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoEgp._id,
            tripId: tripUmrah._id,
            amount: 4500,
            description: "شراء شنط وإحرامات وكتيبات مناسك لرحلة عمرة رجب",
        });
        await api(baseUrl, "POST", "/api/v1/expenses", token, {
            expenseType: "OPERATIONAL_EXPENSE",
            category: "مصروفات تسويق وإعلانات",
            branchId: alexBranch._id.toString(),
            cashboxId: cbAlexEgp._id,
            tripId: tripSharm._id,
            amount: 2500,
            description: "حملة إعلانية لرحلات شرم الشيخ الشتوية",
        });
        await api(baseUrl, "POST", "/api/v1/expenses", token, {
            expenseType: "SUPPLIER_PAYMENT",
            category: "سداد دفعة فندق",
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoSar._id,
            supplierId: supSaudi._id,
            amount: 20000,
            exchangeRateToEgp: 13.5,
            paymentMethod: "BANK_TRANSFER",
            description: "سداد دفعة تحت الحساب لمجموعة الخطوط السعودية والفنادق",
        });
        await api(baseUrl, "POST", "/api/v1/expenses", token, {
            expenseType: "SUPPLIER_PAYMENT",
            category: "سداد دفعة منتجع سياحي",
            branchId: hqBranch._id.toString(),
            cashboxId: cbCairoEgp._id,
            supplierId: supEgypt._id,
            amount: 60000,
            exchangeRateToEgp: 1,
            paymentMethod: "BANK_TRANSFER",
            description: "دفعة تعاقد منتجع ريكسوس شرم الشيخ",
        });
        console.log("✅ Recorded Operational Expenses & Supplier Payments");
        await api(baseUrl, "POST", "/api/v1/transfers", token, {
            fromCashboxId: cbAlexEgp._id,
            toCashboxId: cbCairoEgp._id,
            amount: 30000,
            notes: "توريد نقدية من فرع الإسكندرية إلى الخزينة الرئيسية",
        });
        await api(baseUrl, "POST", `/api/v1/cashboxes/${cbAlexEgp._id}/close-daily`, token, {
            actualCountedBalance: 82500,
            notes: "تقفيل يومي مطابق لخزينة الإسكندرية",
        });
        console.log("✅ Executed Inter-Cashbox Transfer & Daily Cashbox Closure");
        await notifications_1.notificationJobService.runScheduledOperationalJobs();
        console.log("✅ Generated Operational Notifications");
        console.log("\n🎉 FULL DEMO DATA SEEDED SUCCESSFULLY!");
        console.log("──────────────────────────────────────────────");
        console.log("Super Admin Login:  admin@troziana.com / Password123!");
        console.log("GM (Admin) Login:   gm@troziana.com / Password123!");
        console.log("Cairo Manager:      cairo.mgr@troziana.com / Password123!");
        console.log("Alex Manager:       alex.mgr@troziana.com / Password123!");
        console.log("Accountant:         accountant@troziana.com / Password123!");
        console.log("Sales:              sales@troziana.com / Password123!");
        console.log("Procurement:        procurement@troziana.com / Password123!");
        console.log("Operations:         operations@troziana.com / Password123!");
        console.log("Employee (Alex):    employee@troziana.com / Password123!");
        console.log("──────────────────────────────────────────────");
    }
    finally {
        await new Promise((resolve) => server.close(() => resolve()));
        await mongoose_1.default.disconnect();
    }
}
seedDemoData().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});
