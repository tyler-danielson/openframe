function getDayOfWeekName(dow as integer) as string
    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    if dow >= 0 and dow <= 6
        return days[dow]
    end if
    return ""
end function

function getMonthName(month as integer) as string
    months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    if month >= 1 and month <= 12
        return months[month - 1]
    end if
    return ""
end function

function formatDate(dt as object) as string
    return getDayOfWeekName(dt.GetDayOfWeek()) + ", " + getMonthName(dt.GetMonth()) + " " + dt.GetDayOfMonth().ToStr() + ", " + dt.GetYear().ToStr()
end function

function formatTime12(dt as object) as string
    hours = dt.GetHours()
    minutes = dt.GetMinutes()
    period = "AM"
    if hours >= 12
        period = "PM"
    end if
    if hours = 0
        hours = 12
    else if hours > 12
        hours = hours - 12
    end if
    minuteStr = minutes.ToStr()
    if minutes < 10
        minuteStr = "0" + minuteStr
    end if
    return hours.ToStr() + ":" + minuteStr + " " + period
end function

function zeroPad(num as integer) as string
    if num < 10
        return "0" + num.ToStr()
    end if
    return num.ToStr()
end function
