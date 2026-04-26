# Novian - AI-First Real Estate CRM & Operations Platform

## 1. Vision & Strategy
Novian is a premium, multi-tenant, multi-language Real Estate Agency platform designed for the Brazilian market (initially) with a global expansion architecture. It acts as an "AI-first Salesforce for Real Estate," where artificial intelligence handles the entire operational pipeline—lead generation, qualification, CRM management, property matching, and follow-ups—while human experts focus purely on relationship building, high-level strategy, and closing sales.

## 2. Technical Stack
*   **Database & Backend:** Supabase (PostgreSQL, Edge Functions, Auth, Storage, Realtime).
*   **AI Orchestration:** LangGraph.js running natively in Supabase Edge Functions.
*   **LLM Routing:** OpenRouter (access to GPT-4o, Claude 3.5 Sonnet, etc.).
*   **Frontend:** Next.js (React), TailwindCSS, custom UI components.
*   **Messaging:** `n8n` workflows writing WhatsApp events directly into Supabase, plus Brevo for email automation.
*   **Marketing:** Brevo (Email/Marketing Automation).
*   **Data Acquisition:** Firecrawl (Scraping properties from OLX, Zap, etc.).
*   **Multi-tenant:** Row-Level Security (RLS) via Supabase.

## 3. Human Organization Structure

### Hélder Perez (CEO - Chief Executive Officer)
*   **Responsibilities:** General strategy, growth/marketing, technology & AI, brand positioning, strategic decisions.
*   **Reports to:** Partners / Board.
*   **Leads:** Director of Growth & AI, Finance.

### Bruna Sereguin (COO - Chief Operating Officer)
*   **Responsibilities:** Company operations, CRM & pipeline management, lead organization, execution control, service quality.
*   **Reports to:** CEO.
*   **Leads:** Operations Manager (AI).

### Bárbara Camargo (CREO - Chief Real Estate Officer)
*   **Responsibilities:** Real estate operations, developer relationships, physical visits/viewings, negotiation & closing.
*   **Reports to:** CEO.
*   **Leads:** Sales Manager (AI).

---

## 4. AI Agents Hierarchy & Orchestration (Powered by LangGraph)

The AI architecture mirrors a real corporate structure. Management agents coordinate tasks and route data to specialized execution agents.

### Management & Coordination Agents (Supervisors)

**1. Daniel Rocha (Director of Growth & AI)**
*   **Role:** Manages the digital sales funnel, agent performance, script optimization, and the customer journey.
*   **Reports to:** CEO (Hélder).
*   **Leads:** Mariana, Lucas, Camila, Rafael.
*   **System Function:** The primary LangGraph "Router" Agent. Receives incoming leads (via WhatsApp/Brevo) and decides whether to route them to the SDR, Qualification, or Property Advisor agents.

**2. Ana Costa (Operations Manager)**
*   **Role:** CRM management, pipeline organization, lead tracking, process execution guarantee.
*   **Reports to:** COO (Bruna).
*   **System Function:** The "Data Integrity" Agent. Monitors Supabase tables. Ensures leads aren't dropped, alerts Daniel if a lead is stuck, and formats scraped data from Firecrawl into standardized CRM entries.

**3. Ricardo Nunes (Sales Manager)**
*   **Role:** Coordination of qualified leads, organizing physical visits, opportunity distribution.
*   **Reports to:** CREO (Bárbara).
*   **System Function:** The "Handoff" Agent. When a lead is fully qualified and ready to view a property, Ricardo assigns the lead to a human broker, syncs the calendar, and briefs the human agent on the lead's history.

### Execution Agents (Workers)

**1. **Mariana Silva (AI SDR)**
*   **Role:** First contact, conversation initiation, initial engagement.
*   **System Function:** Starts the first WhatsApp outreach when a lead is captured, using message events persisted by `n8n` in Supabase.

**2. Lucas Andrade (AI Client Qualification Specialist)**
*   **Role:** Lead qualification, understanding profile/budget/needs, filtering opportunities.
*   **System Function:** Takes over from Mariana once the lead engages. Asks strategic questions to fill out the CRM profile (budget, desired neighborhoods, timeline).

**3. Camila Rocha (AI Property Advisor)**
*   **Role:** Presenting properties, sending relevant options, driving interest.
*   **System Function:** Queries the Supabase property database based on Lucas's qualification data. Generates personalized property pitches and sends images/links to the lead.

**4. Rafael Martins (AI Client Success Specialist)**
*   **Role:** Follow-ups, lead re-engagement, relationship continuity.
*   **System Function:** Monitors "cold" leads in the CRM. Automatically triggers re-engagement campaigns via WhatsApp or Brevo after 7, 14, or 30 days of inactivity.

---

## 5. Core Platform Modules
1.  **Multi-tenant CRM:** Manage Leads, Clients, and Funnels with dynamic custom fields.
2.  **Centralized AI War Room (The Hub):** A real-time chat interface where humans and AI agents coexist. Agents communicate with each other autonomously, start threads, assign tasks, and make decisions 24/7 without requiring human triggers. Humans can drop in to monitor, give high-level commands, or answer questions when agents escalate a complex decision.
3.  **Property Management & Scraping:** Internal listings database + Firecrawl integration to auto-import from external sites.
4.  **Communication Hub:** Centralized WhatsApp and Email (Brevo) inbox backed by database events.
5.  **Internal Landing Page Builder:** Generate lead-capture pages dynamically.
6.  **Financial & Reporting Module:** Custom dashboards for real-time visibility and contract management (PDF generation).
7.  **AI Image Enhancer:** Automated upscaling/enhancement of property photos upon upload.

## 6. Agent Autonomy & Triggers
To achieve 100% autonomy without waiting for human input, the AI agents will operate on three core triggers:
*   **Event-Driven:** A new lead arrives (via Webhook) -> Daniel (Director) wakes up -> Analyzes lead -> Pings Mariana (SDR) in the War Room -> Mariana texts the lead via WhatsApp.
*   **Time-Driven (Heartbeat):** Every hour, Rafael (Client Success) scans the database for "cold" leads. If he finds one, he starts a thread in the War Room tagging Ana (Ops) to log the action, then messages the lead to re-engage.
*   **Proactive Collaboration:** When Lucas (Qualification) finishes qualifying a lead, he autonomously tags Camila (Property Advisor) and Ricardo (Sales Manager) in the War Room chat: *"Hey team, I just qualified João. Budget 1.5M, looking for Jardins. Camila, please pull some properties. Ricardo, he wants to visit next Tuesday."*
