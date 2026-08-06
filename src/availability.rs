//! Yearly chore availability windows.
//!
//! A chore may be limited to part of the calendar year - a school-year chore runs
//! Sep 1 to Jun 15 and repeats every year. The window is stored as two nullable
//! MMDD integers on `chores` and is inclusive at both ends.
//!
//! The MMDD encoding (`month * 100 + day`) sorts in calendar order, which is what
//! reduces the "does this date fall in the window" question to a pair of integer
//! comparisons - including the wrap-the-new-year case.
//!
//! This logic is mirrored in `site/src/utils/availabilityWindow.ts`. The two test
//! tables are deliberately identical; change one and you must change the other.

use anyhow::{Result, bail};
use chrono::{Datelike, NaiveDate};

/// A day of the year with no year attached, encoded as `month * 100 + day`.
///
/// Sep 1 is `901`, Jun 15 is `615`, Dec 31 is `1231`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct MonthDay(i32);

impl MonthDay {
    /// Days in `month`, or 0 when `month` is out of range.
    ///
    /// February reports 29: a window boundary is a month/day pair with no year, so
    /// it has no leap year in which to be valid or invalid. Feb 29 as a boundary
    /// simply sorts after Feb 28 and before Mar 1, which is the behaviour we want
    /// in every year.
    const fn days_in_month(month: u32) -> u32 {
        match month {
            1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
            4 | 6 | 9 | 11 => 30,
            2 => 29,
            _ => 0,
        }
    }

    /// Builds a `MonthDay`, rejecting a month outside 1-12 or a day outside the
    /// range that month allows.
    pub fn new(month: u32, day: u32) -> Result<Self> {
        let max_day = Self::days_in_month(month);
        if max_day == 0 {
            bail!("Month must be between 1 and 12, got {month}");
        }
        if day == 0 || day > max_day {
            bail!("Day must be between 1 and {max_day} for month {month}, got {day}");
        }
        Ok(Self(
            i32::try_from(month * 100 + day).expect("month/day fits in i32"),
        ))
    }

    /// Decodes a stored MMDD column value, revalidating it.
    pub fn from_mmdd(mmdd: i32) -> Result<Self> {
        if mmdd < 0 {
            bail!("MMDD value must not be negative, got {mmdd}");
        }
        let month = u32::try_from(mmdd / 100).expect("checked non-negative");
        let day = u32::try_from(mmdd % 100).expect("checked non-negative");
        Self::new(month, day)
    }

    /// Drops the year from `date`.
    pub fn from_date(date: NaiveDate) -> Self {
        let month = i32::try_from(date.month()).expect("chrono month is 1-12");
        let day = i32::try_from(date.day()).expect("chrono day is 1-31");
        Self(month * 100 + day)
    }

    pub const fn month(self) -> i32 {
        self.0 / 100
    }

    pub const fn day(self) -> i32 {
        self.0 % 100
    }

    /// The MMDD encoding, for storage in the `available_start` / `available_end`
    /// columns.
    pub const fn as_mmdd(self) -> i32 {
        self.0
    }
}

/// An inclusive month/day range that repeats every year.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AvailabilityWindow {
    start: MonthDay,
    end: MonthDay,
}

impl AvailabilityWindow {
    pub const fn new(start: MonthDay, end: MonthDay) -> Self {
        Self { start, end }
    }

    /// Reads a window from the two nullable columns.
    ///
    /// Both NULL means the chore is available year round. Exactly one set is a
    /// half-open window, which the domain does not allow, so it is an error rather
    /// than a silent default.
    pub fn from_columns(start: Option<i32>, end: Option<i32>) -> Result<Option<Self>> {
        match (start, end) {
            (None, None) => Ok(None),
            (Some(start), Some(end)) => Ok(Some(Self::new(
                MonthDay::from_mmdd(start)?,
                MonthDay::from_mmdd(end)?,
            ))),
            (Some(_), None) => bail!("Availability window has a start but no end"),
            (None, Some(_)) => bail!("Availability window has an end but no start"),
        }
    }

    pub const fn start(&self) -> MonthDay {
        self.start
    }

    pub const fn end(&self) -> MonthDay {
        self.end
    }

    /// Whether `date` falls inside the window, inclusive at both ends.
    ///
    /// When `start <= end` the window sits inside one calendar year. When
    /// `start > end` it wraps the new year - a Sep 1 to Jun 15 school year is in
    /// season in December and in March, but not in July.
    pub fn contains(&self, date: NaiveDate) -> bool {
        let day = MonthDay::from_date(date).as_mmdd();
        let (start, end) = (self.start.as_mmdd(), self.end.as_mmdd());
        if start <= end {
            start <= day && day <= end
        } else {
            day >= start || day <= end
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    #[test]
    fn month_day_accepts_valid_dates() {
        assert_eq!(MonthDay::new(9, 1).unwrap().as_mmdd(), 901);
        assert_eq!(MonthDay::new(6, 15).unwrap().as_mmdd(), 615);
        assert_eq!(MonthDay::new(12, 31).unwrap().as_mmdd(), 1231);
        assert_eq!(MonthDay::new(1, 1).unwrap().as_mmdd(), 101);
    }

    #[test]
    fn month_day_accepts_feb_29() {
        // A window boundary is a month/day pair with no year, so Feb 29 is a
        // well-defined boundary even though it is not a date in every year.
        let feb29 = MonthDay::new(2, 29).unwrap();
        assert_eq!(feb29.as_mmdd(), 229);
    }

    #[test]
    fn month_day_rejects_out_of_range_values() {
        assert!(MonthDay::new(0, 15).is_err(), "month 0");
        assert!(MonthDay::new(13, 1).is_err(), "month 13");
        assert!(MonthDay::new(6, 0).is_err(), "day 0");
        assert!(MonthDay::new(2, 30).is_err(), "Feb 30");
        assert!(MonthDay::new(4, 31).is_err(), "Apr 31");
        assert!(MonthDay::new(1, 32).is_err(), "Jan 32");
    }

    #[test]
    fn month_day_accessors_decode_the_encoding() {
        let md = MonthDay::new(9, 1).unwrap();
        assert_eq!(md.month(), 9);
        assert_eq!(md.day(), 1);
    }

    #[test]
    fn month_day_from_mmdd_revalidates() {
        assert_eq!(MonthDay::from_mmdd(901).unwrap().as_mmdd(), 901);
        assert!(MonthDay::from_mmdd(1301).is_err(), "month 13");
        assert!(MonthDay::from_mmdd(230).is_err(), "Feb 30");
        assert!(MonthDay::from_mmdd(-5).is_err(), "negative");
    }

    #[test]
    fn month_day_from_date_drops_the_year() {
        assert_eq!(MonthDay::from_date(date(2026, 9, 1)).as_mmdd(), 901);
        assert_eq!(MonthDay::from_date(date(1999, 9, 1)).as_mmdd(), 901);
    }

    /// Non-wrapping window: a summer-only chore.
    #[test]
    fn contains_non_wrapping_window() {
        let w =
            AvailabilityWindow::new(MonthDay::new(6, 1).unwrap(), MonthDay::new(8, 31).unwrap());

        assert!(w.contains(date(2026, 7, 4)), "mid window");
        assert!(w.contains(date(2026, 6, 1)), "start is inclusive");
        assert!(w.contains(date(2026, 8, 31)), "end is inclusive");
        assert!(!w.contains(date(2026, 5, 31)), "day before start");
        assert!(!w.contains(date(2026, 9, 1)), "day after end");
        assert!(!w.contains(date(2026, 1, 15)), "far outside");
    }

    /// Wrapping window: the school year, Sep 1 - Jun 15.
    #[test]
    fn contains_wrapping_window() {
        let w =
            AvailabilityWindow::new(MonthDay::new(9, 1).unwrap(), MonthDay::new(6, 15).unwrap());

        assert!(w.contains(date(2026, 9, 1)), "start is inclusive");
        assert!(w.contains(date(2026, 10, 20)), "autumn");
        assert!(w.contains(date(2026, 12, 31)), "last day of the year");
        assert!(w.contains(date(2027, 1, 1)), "first day of the year");
        assert!(w.contains(date(2027, 3, 10)), "spring");
        assert!(w.contains(date(2027, 6, 15)), "end is inclusive");

        assert!(!w.contains(date(2027, 6, 16)), "day after end");
        assert!(!w.contains(date(2027, 7, 4)), "summer");
        assert!(!w.contains(date(2027, 8, 31)), "day before start");
    }

    #[test]
    fn contains_single_day_window() {
        let w =
            AvailabilityWindow::new(MonthDay::new(3, 14).unwrap(), MonthDay::new(3, 14).unwrap());

        assert!(w.contains(date(2026, 3, 14)));
        assert!(!w.contains(date(2026, 3, 13)));
        assert!(!w.contains(date(2026, 3, 15)));
    }

    #[test]
    fn from_columns_requires_both_or_neither() {
        assert!(
            AvailabilityWindow::from_columns(None, None)
                .unwrap()
                .is_none()
        );

        let w = AvailabilityWindow::from_columns(Some(901), Some(615))
            .unwrap()
            .expect("both columns set yields a window");
        assert_eq!(w.start().as_mmdd(), 901);
        assert_eq!(w.end().as_mmdd(), 615);

        assert!(
            AvailabilityWindow::from_columns(Some(901), None).is_err(),
            "start without end"
        );
        assert!(
            AvailabilityWindow::from_columns(None, Some(615)).is_err(),
            "end without start"
        );
    }

    #[test]
    fn from_columns_rejects_invalid_encodings() {
        assert!(AvailabilityWindow::from_columns(Some(1301), Some(615)).is_err());
        assert!(AvailabilityWindow::from_columns(Some(901), Some(230)).is_err());
    }
}
