#!/bin/bash
FILE="/tmp/old_admin_page.tsx"

# Extract NewLeadForm
awk '/function NewLeadForm/,/^}/' "$FILE" > src/components/NewLeadForm.tsx

# Extract WarRoomLayout and its dependencies
awk '/function WarRoomLayout/,/^}/' "$FILE" > src/app/admin/chat/page.tsx
awk '/function ChatInput/,/^}/' "$FILE" >> src/app/admin/chat/page.tsx
awk '/function ThreadItem/,/^}/' "$FILE" >> src/app/admin/chat/page.tsx
awk '/function AgentAvatar/,/^}/' "$FILE" >> src/app/admin/chat/page.tsx
awk '/function Message/,/^}/' "$FILE" >> src/app/admin/chat/page.tsx

# Extract LeadsLayout
awk '/function LeadsLayout/,/^}/' "$FILE" > src/app/admin/leads/page.tsx

# Extract PropertiesLayout
awk '/function PropertiesLayout/,/^}/' "$FILE" > src/app/admin/properties/page.tsx

# Extract SettingsLayout and WhatsAppInstanceCard
awk '/function SettingsLayout/,/^}/' "$FILE" > src/app/admin/settings/page.tsx
awk '#!/bin/bash
FILE="/tmp/old_admin_page.tsx"

# Extract NewLppFILE="/tmpti
# Extract NewLeadForm
awk traawk '"/function Nxt