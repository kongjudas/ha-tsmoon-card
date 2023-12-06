export default class SunCalc {

    private static readonly sin = Math.sin;
    private static readonly cos = Math.cos;
    private static readonly tan = Math.tan;
    private static readonly asin = Math.asin;
    private static readonly atan = Math.atan2;
    private static readonly acos = Math.acos;
    private static readonly rad = Math.PI / 180;
    private static readonly degr = 180 / Math.PI;

    // date/time constants and conversions
    private static readonly dayMs = 86400000; // 1000 * 60 * 60 * 24;
    private static readonly J1970 = 2440587.5;
    private static readonly J2000 = 2451545;

    private static readonly lunarDaysMs = 2551442778; // The duration in days of a lunar cycle is 29.53058770576
    private static readonly firstNewMoon2000 = 947178840000; // first newMoon in the year 2000 2000-01-06 18:14

    private static fromJulianDay(j: number): number {
        return (j - SunCalc.J1970) * SunCalc.dayMs;
    }

    private static toDays(dateValue: number): number {
        return ((dateValue / SunCalc.dayMs) + SunCalc.J1970) - SunCalc.J2000;
    }

    private static rightAscension(l: number, b: number): number {
        return Math.atan(Math.sin(l) * Math.cos(SunCalc.e) - Math.tan(b) * Math.sin(SunCalc.e), Math.cos(l));
    }

    private static declination(l: number, b: number): number {
        return Math.asin(Math.sin(b) * Math.cos(SunCalc.e) + Math.cos(b) * Math.sin(SunCalc.e) * Math.sin(l));
    }

    private static azimuthCalc(H: number, phi: number, dec: number): number {
        return Math.atan(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;
    }

    private static altitudeCalc(H: number, phi: number, dec: number): number {
        return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    }

    private static siderealTime(d: number, lw: number): number {
        return SunCalc.rad * (280.16 + 360.9856235 * d) - lw;
    }

    private static astroRefraction(h: number): number {
        if (h < 0) {
            h = 0;
        }

        return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
    }

    private static solarMeanAnomaly(d: number): number {
        return SunCalc.rad * (357.5291 + 0.98560028 * d);
    }

    private static eclipticLongitude(M: number): number {
        const C = SunCalc.rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
        const P = SunCalc.rad * 102.9372; // perihelion of the Earth
        return M + C + P + Math.PI;
    }

    private static sunCoords(d: number): ISunCoordinates {
        const M = SunCalc.solarMeanAnomaly(d);
        const L = SunCalc.eclipticLongitude(M);

        return {
            dec: SunCalc.declination(L, 0),
            ra: SunCalc.rightAscension(L, 0)
        };
    }

    public static getPosition(dateValue: number | Date, lat: number, lng: number): ISunPosition {
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
        if (isNaN(lng)) {
            throw new Error('longitude missing');
        }
        if (dateValue instanceof Date) {
            dateValue = dateValue.valueOf();
        }
        const lw = SunCalc.rad * -lng;
        const phi = SunCalc.rad * lat;
        const d = SunCalc.toDays(dateValue);
        const c = SunCalc.sunCoords(d);
        const H = SunCalc.siderealTime(d, lw) - c.ra;
        const azimuth = SunCalc.azimuthCalc(H, phi, c.dec);
        const altitude = SunCalc.altitudeCalc(H, phi, c.dec);

        return {
            azimuth,
            altitude,
            zenith: (90 * Math.PI / 180) - altitude,
            azimuthDegrees: SunCalc.degr * azimuth,
            altitudeDegrees: SunCalc.degr * altitude,
            zenithDegrees: 90 - (SunCalc.degr * altitude),
            declination: c.dec
        };
    }

    private static sunTimes = [
        { angle: 6, riseName: 'goldenHourDawnEnd', setName: 'goldenHourDuskStart'},
        { angle: -0.3, riseName: 'sunriseEnd', setName: 'sunsetStart'},
        { angle: -0.833, riseName: 'sunriseStart', setName: 'sunsetEnd'},
        { angle: -1, riseName: 'goldenHourDawnStart', setName: 'goldenHourDuskEnd'},
        { angle: -4, riseName: 'blueHourDawnEnd', setName: 'blueHourDuskStart'},
        { angle: -6, riseName: 'civilDawn', setName: 'civilDusk'},
        { angle: -8, riseName: 'blueHourDawnStart', setName: 'blueHourDuskEnd'},
        { angle: -12, riseName: 'nauticalDawn', setName: 'nauticalDusk'},
        { angle: -15, riseName: 'amateurDawn', setName: 'amateurDusk'},
        { angle: -18, riseName: 'astronomicalDawn', setName: 'astronomicalDusk'}
    ];

    private static suntimesDeprecated = [
        ['dawn', 'civilDawn'],
        ['dusk', 'civilDusk'],
        ['nightEnd', 'astronomicalDawn'],
        ['night', 'astronomicalDusk'],
        ['nightStart', 'astronomicalDusk'],
        ['goldenHour', 'goldenHourDuskStart'],
        ['sunrise', 'sunriseStart'],
        ['sunset', 'sunsetEnd'],
        ['goldenHourEnd', 'goldenHourDawnEnd'],
        ['goldenHourStart', 'goldenHourDuskStart']
    ];

    public static addTime(angleAltitude: number, riseName: string, setName: string, risePos?: number, setPos?: number, degree: boolean = true): boolean {
        let isValid = (typeof riseName === 'string') && (riseName.length > 0) &&
                      (typeof setName === 'string') && (setName.length > 0) &&
                      (typeof angleAltitude === 'number');
        if (isValid) {
            const EXP = /^(?![0-9])[a-zA-Z0-9$_]+$/;
            for (let i = 0; i < SunCalc.sunTimes.length; ++i) {
                if (!EXP.test(riseName) || riseName === SunCalc.sunTimes[i].riseName || riseName === SunCalc.sunTimes[i].setName) {
                    isValid = false;
                    break;
                }
                if (!EXP.test(setName) || setName === SunCalc.sunTimes[i].riseName || setName === SunCalc.sunTimes[i].setName) {
                    isValid = false;
                    break;
                }
            }
            if (isValid) {
                const angleDeg = degree ? angleAltitude : angleAltitude * (180 / Math.PI);
                SunCalc.sunTimes.push({ angle: angleDeg, riseName, setName, risePos, setPos });
                for (let i = SunCalc.suntimesDeprecated.length - 1; i >= 0; i--) {
                    if (SunCalc.suntimesDeprecated[i][0] === riseName || SunCalc.suntimesDeprecated[i][0] === setName) {
                        SunCalc.suntimesDeprecated.splice(i, 1);
                    }
                }
                return true;
            }
        }
        return false;
    }

    public static addDeprecatedTimeName(alternameName: string, originalName: string): boolean {
        let isValid = (typeof alternameName === 'string') && (alternameName.length > 0) &&
                      (typeof originalName === 'string') && (originalName.length > 0);
        if (isValid) {
            let hasOrg = false;
            const EXP = /^(?![0-9])[a-zA-Z0-9$_]+$/;
            for (let i = 0; i < SunCalc.sunTimes.length; ++i) {
                if (!EXP.test(alternameName) || alternameName === SunCalc.sunTimes[i].riseName || alternameName === SunCalc.sunTimes[i].setName) {
                    isValid = false;
                    break;
                }
                if (originalName === SunCalc.sunTimes[i].riseName || originalName === SunCalc.sunTimes[i].setName) {
                    hasOrg = true;
                }
            }
            if (isValid && hasOrg) {
                SunCalc.suntimesDeprecated.push([alternameName, originalName]);
                return true;
            }
        }
        return false;
    }

    private static readonly J0 = 0.0009;

    private static julianCycle(d: number, lw: number): number {
        return Math.round(d - SunCalc.J0 - lw / (2 * Math.PI));
    }

    private static approxTransit(Ht: number, lw: number, n: number): number {
        return SunCalc.J0 + (Ht + lw) / (2 * Math.PI) + n;
    }

    private static solarTransitJ(ds: number, M: number, L: number): number {
        return SunCalc.J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    }

    private static hourAngle(h: number, phi: number, dec: number): number {
        return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    }

    private static observerAngle(height: number): number {
        return -2.076 * Math.sqrt(height) / 60;
    }

// ... (Previous code)

    private static getSetJ(h: number, lw: number, phi: number, dec: number, n: number, M: number, L: number): number {
        const w = SunCalc.hourAngle(h, phi, dec);
        const a = SunCalc.approxTransit(w, lw, n);
        return SunCalc.solarTransitJ(a, M, L);
    }

    public static getSunTimes(dateValue: number, lat: number, lng: number, height: number, addDeprecated: boolean, inUTC: boolean): any {
        // Implementation of getSunTimes method
        // ...

        return result;
    }

    public static getSunTime(dateValue: number, lat: number, lng: number, elevationAngle: number, height: number, degree: boolean, inUTC: boolean): any {
        if (isNaN(lat)) {
            throw new Error('latitude missing');
        }
       if (isNaN(lng)) {
        throw new Error('longitude missing');
       }
       if (isNaN(elevationAngle)) {
            throw new Error('elevationAngle missing');
        }

        if (degree) {
            elevationAngle = elevationAngle * SunCalc.rad;
        }

        // ... Implementation of getSunTime method ...

        return {
            set: {
                name: 'set',
                value: new Date(v1),
                ts: v1,
                elevation: elevationAngle,
                julian: Jset,
                valid: !isNaN(Jset),
                pos: 0
            },
            rise: {
                name: 'rise',
                value: new Date(v2),
                ts: v2,
                elevation: elevationAngle,
                julian: Jrise,
                valid: !isNaN(Jrise),
                pos: 1
            }
        };
    }


    public static getSunTimeByAzimuth(dateValue: number, lat: number, lng: number, nazimuth: number, degree: boolean): Date {
        // Implementation of getSunTimeByAzimuth method
        // ...

        return new Date(Math.floor(dateVal));
    }

    public static getSolarTime(dateValue: number, lng: number, utcOffset: number): Date {
        // Implementation of getSolarTime method
        // ...

        return solarDate;
    }

    private static moonCoords(d: number): { ra: number, dec: number, dist: number } {
        // Implementation of moonCoords method
        // ...

        return {
            ra: rightAscension(l, b),
            dec: declination(l, b),
            dist: dt
        };
    }

public static getMoonPosition(dateValue: number, lat: number, lng: number): any {
    // Implementation of getMoonPosition method
    // ...

    return {
        azimuth,
        altitude,
        azimuthDegrees: degr * azimuth,
        altitudeDegrees: degr * altitude,
        distance: c.dist,
        parallacticAngle: pa,
        parallacticAngleDegrees: degr * pa
    };
}

    public static moonCycles = [{
        // ... (Moon cycle entries)
    }];

    // ... (Rest of the code)

    public static getMoonIllumination(dateValue: number): any {
    // Implementation of getMoonIllumination method
    // ...

    return {
        fraction: (1 + cos(inc)) / 2,
        phase,
        phaseValue,
        angle,
        next: {
            // ... (Next moon events)
        }
    };
    }

    public static getMoonData(dateValue: number, lat: number, lng: number): any {
    // Implementation of getMoonData method
    // ...

    return Object.assign({
        illumination: illum,
        zenithAngle: illum.angle - pos.parallacticAngle
    }, pos);
    }

    private static hoursLater(dateValue: number, h: number): number {
    // Implementation of hoursLater method
    // ...

    return dateValue + h * dayMs / 24;
    }

    public static getMoonTimes(dateValue: number, lat: number, lng: number, inUTC: boolean): any {
    // Implementation of getMoonTimes method
    // ...

    return result;
    }


public static calcMoonTransit(rize: number, set: number): Date {
    if (rize > set) {
        return new Date(set + (rize - set) / 2);
    }
    return new Date(rize + (set - rize) / 2);
}

public static moonTransit(rise: number, set: number, lat: number, lng: number): { main: Date | null, invert: Date | null } {
    let main = null;
    let invert = null;
    const riseDate = new Date(rise);
    const setDate = new Date(set);
    const riseValue = riseDate.getTime();
    const setValue = setDate.getTime();
    const day = setDate.getDate();
    let tempTransitBefore;
    let tempTransitAfter;

    if (rise && set) {
        if  (rise < set) {
            main = SunCalc.calcMoonTransit(riseValue, setValue);
        } else {
            invert = SunCalc.calcMoonTransit(riseValue, setValue);
        }
    }

    if (rise) {
        tempTransitAfter = SunCalc.calcMoonTransit(riseValue, SunCalc.getMoonTimes(new Date(riseDate).setDate(day + 1), lat, lng).set.valueOf());
        if (tempTransitAfter.getDate() === day) {
            if (main) {
                invert = tempTransitAfter;
            } else {
                main = tempTransitAfter;
            }
        }
    }

    if (set) {
        tempTransitBefore = SunCalc.calcMoonTransit(setValue, SunCalc.getMoonTimes(new Date(setDate).setDate(day - 1), lat, lng).rise.valueOf());
        if (tempTransitBefore.getDate() === day) {
            main = tempTransitBefore;
        }
    }

    return {
        main,
        invert
    };
}

};


