!macro customInstall
  WriteRegStr HKCU "Software\Classes\UniqueMail.Url.mailto" "" "Unique Mail E-Mail-Link"
  WriteRegStr HKCU "Software\Classes\UniqueMail.Url.mailto" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\UniqueMail.Url.mailto\DefaultIcon" "" '"$INSTDIR\Unique Mail.exe",0'
  WriteRegStr HKCU "Software\Classes\UniqueMail.Url.mailto\shell\open\command" "" '"$INSTDIR\Unique Mail.exe" "%1"'

  WriteRegStr HKCU "Software\Unique Mail\Capabilities" "ApplicationName" "Unique Mail"
  WriteRegStr HKCU "Software\Unique Mail\Capabilities" "ApplicationDescription" "Lokaler Desktop-E-Mail-Client mit IMAP- und SMTP-Unterstuetzung."
  WriteRegStr HKCU "Software\Unique Mail\Capabilities" "ApplicationIcon" '"$INSTDIR\Unique Mail.exe",0'
  WriteRegStr HKCU "Software\Unique Mail\Capabilities\URLAssociations" "mailto" "UniqueMail.Url.mailto"
  WriteRegStr HKCU "Software\RegisteredApplications" "Unique Mail" "Software\Unique Mail\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\RegisteredApplications" "Unique Mail"
  DeleteRegKey HKCU "Software\Unique Mail\Capabilities"
  DeleteRegKey HKCU "Software\Unique Mail"
  DeleteRegKey HKCU "Software\Classes\UniqueMail.Url.mailto"
!macroend
