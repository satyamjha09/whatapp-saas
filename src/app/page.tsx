import Link from 'next/link'
import styles from './page.module.css'
import { FileText, Clock, CheckCircle2, XCircle, Shield, Zap } from 'lucide-react'



const features = [
  ['Automation', 'Follow-ups, payment reminders and workflows that keep moving.'],
  ['Bulk Campaigns', 'Broadcast approved WhatsApp templates to the right customers.'],
  ['Auto Replies', 'Respond faster with smart replies, routing and saved answers.'],
  ['Analytics', 'Track delivery, conversations, replies and customer activity.'],
  ['Team Inbox', 'Assign chats, add notes and keep the whole team aligned.'],
  ['Tally Sync', 'Connect customers, invoices and payment updates with Tally.'],
]

const integrations = ['Tally Prime', 'Google Sheets', 'Zapier', 'API Access', 'Webhooks']

const testimonials = [
  ['Rohit Gupta', 'Gupta & Co.', 'TallyKonnect helped us manage customer communication from one place. Our response time improved within the first week.'],
  ['Anjali Mehta', 'Mehta Finance Solutions', 'The automation and Tally workflow feels made for finance teams. It is clean, practical and easy to recommend.'],
  ['Vikram Jain', 'Jain Traders', 'We moved reminders, replies and campaigns into one system. The team finally has a clear view of every conversation.'],
]

const plans: {
  name: string
  price: string
  detail: string
  items: string[]
}[] = [
  {
    name: 'Starter',
    price: 'Rs. 999',
    detail: 'Perfect for small businesses',
    items: ['1 WhatsApp number', '1,000 messages / month', 'Basic automation', 'Email support'],
  },
  {
    name: 'Growth',
    price: 'Rs. 2,999',
    detail: 'For growing teams',
    items: ['5 WhatsApp numbers', '10,000 messages / month', 'Advanced automation', 'Chatbot and auto reply', 'Priority support'],
  },
  {
    name: 'Scale',
    price: 'Rs. 7,999',
    detail: 'For larger businesses',
    items: ['Unlimited WhatsApp numbers', 'Unlimited messages', 'Team collaboration', 'Dedicated support'],
  },
]

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navContainer}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark} aria-hidden="true">
              <span />
            </span>
            <span>TallyKonnect</span>
          </Link>
          <div className={styles.navLinks} aria-label="Primary navigation">
            <Link href="/">Home</Link>
            <Link href="#features">Solutions <span className={styles.chevron}>v</span></Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="#footer">Contact Us</Link>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.navDashboardButton} href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroContainer}>
          <div className={styles.heroContent}>
            <span className={styles.badge}>WhatsApp + Tally, connected for growth</span>
            <h1>
              Automate WhatsApp. Manage Business.
              <br />
              <span>Grow More.</span>
            </h1>
            <p>
              TallyKonnect helps finance teams and businesses automate WhatsApp conversations,
              manage customer communication and sync important data with Tally from one clean platform.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/sign-up">
                Start Free Trial
              </Link>
              <Link className={styles.secondaryButton} href="/sign-in">
                Book a Demo
              </Link>
            </div>
            <div className={styles.trustRow}>
              <span>No credit card required</span>
              <span>14-day free trial</span>
              <span>Cancel anytime</span>
            </div>
          </div>

          <div className={styles.productVisual} aria-label="TallyKonnect dashboard preview">
            <div className={styles.sidebar}>
              <span className={styles.sidebarLogo}>TK</span>
              {['Dashboard', 'Conversations', 'Contacts', 'Campaigns', 'Templates', 'Analytics'].map((item) => (
                <span key={item} className={item === 'Dashboard' ? styles.activeNavItem : undefined}>
                  {item}
                </span>
              ))}
            </div>
            <div className={styles.dashboard}>
              <div className={styles.dashboardHeader}>
                <div>
                  <strong>Dashboard</strong>
                  <small>Welcome back, Satyam</small>
                </div>
                <span>This Month</span>
              </div>
              <div className={styles.metricGrid}>
                {[
                  ['24,589', 'Total Conversations'],
                  ['112,300', 'Messages Sent'],
                  ['16,735', 'Active Contacts'],
                  ['98.6%', 'Delivery Rate'],
                ].map(([value, label]) => (
                  <div className={styles.metricCard} key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                    <small>+21.7%</small>
                  </div>
                ))}
              </div>
              <div className={styles.dashboardPanels}>
                <div className={styles.chartCard}>
                  <span>Conversations Overview</span>
                  <div className={styles.chartBars}>
                    {[32, 44, 38, 61, 54, 70, 92].map((height) => (
                      <i key={height} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
                <div className={styles.campaignCard}>
                  <span>Recent Campaigns</span>
                  {['Payment Reminder', 'New Product Launch', 'Festival Offer'].map((campaign) => (
                    <p key={campaign}>
                      <b>{campaign}</b>
                      <small>Sent</small>
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.whatsappBubble}>WA</div>
          </div>
        </div>
      </section>

      <section className={styles.clientStrip} aria-label="Trusted businesses">
        <div className={styles.clientStripContainer}>
          {['Sree Balaji Enterprises', 'Gupta & Co.', 'KVR Consultants', 'Jain Traders', 'Mehta Finance Solutions'].map((client) => (
            <span key={client}>{client}</span>
          ))}
        </div>
      </section>

      <section className={styles.featuresSection} id="features">
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Everything you need</span>
            <h2>
              Automate and scale on <span>WhatsApp</span>
            </h2>
          </div>
          <div className={styles.featureGrid}>
            {features.map(([title, copy], index) => (
              <article className={styles.featureCard} key={title}>
                <span className={styles.icon}>{String(index + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.integrationBand} id="integrations">
        <div className={styles.integrationBandContainer}>
          <div>
            <span className={styles.badgeDark}>Powerful integrations</span>
            <h2>Works seamlessly with your tools</h2>
            <p>Connect TallyKonnect with the platforms you already use and automate communication, reminders and data flow.</p>
          </div>
          <div className={styles.integrationGrid}>
            {integrations.map((integration) => (
              <span key={integration}>{integration}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>How it works</span>
            <h2>
              Get started in <span>3 simple steps</span>
            </h2>
          </div>
          <div className={styles.steps}>
            {[
              ['Connect WhatsApp', 'Connect your WhatsApp number in a few clicks.'],
              ['Set up automation', 'Create templates, replies and workflows.'],
              ['Engage and grow', 'Launch campaigns and convert conversations.'],
            ].map(([title, copy], index) => (
              <article className={styles.stepCard} key={title}>
                <span>{index + 1}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.conversationSection}>
        <div className={styles.conversationSectionContainer}>
          <div>
            <span className={styles.kicker}>Built for businesses</span>
            <h2>A better way to manage customer conversations</h2>
            <ul>
              <li>Centralized inbox for all WhatsApp conversations</li>
              <li>Quick replies, tags and notes to close conversations faster</li>
              <li>Secure, reliable and built for scale</li>
            </ul>
          </div>
          <div className={styles.inboxMockup}>
            <div className={styles.inboxList}>
              <strong>Inbox</strong>
              {['Ravi Kumar', 'Priya Sharma', 'Amit Verma', 'Neha Jain'].map((name, index) => (
                <span key={name} className={index === 0 ? styles.selectedChat : undefined}>
                  {name}
                  <small>{index === 0 ? 'Please share the invoice.' : 'Message received'}</small>
                </span>
              ))}
            </div>
            <div className={styles.chatPanel}>
              <strong>Ravi Kumar</strong>
              <p>Hi, I am interested in your product.</p>
              <p className={styles.reply}>Hello Ravi. How can we help you today?</p>
              <p>Can you share the pricing details?</p>
              <p className={styles.reply}>Sure. Please find the details here.</p>
            </div>
          </div>
        </div>
      </section>

      {/* NEW: Tally Automated Reminders Workflow Showcase */}
      <section className={styles.showcaseSection}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Tally ERP Automation</span>
            <h2>Built Specifically for <span>Tally ERP Workflows</span></h2>
            <p style={{ marginTop: '12px', color: '#526173' }}>
              No manual uploads. TallyKonnect connects directly with your Tally ERP database to automate major business communications in real time.
            </p>
          </div>
          <div className={styles.showcaseGrid}>
            <article className={styles.showcaseCard}>
              <div className={styles.showcaseIcon}>
                <FileText className="h-6 w-6" />
              </div>
              <h3>Sales Invoices</h3>
              <p>Send clean PDF invoices on WhatsApp as soon as they are made in Tally. Fast, official, and direct.</p>
            </article>
            <article className={styles.showcaseCard}>
              <div className={styles.showcaseIcon}>
                <Clock className="h-6 w-6" />
              </div>
              <h3>Outstanding Reminders</h3>
              <p>Automatically schedule friendly payment alerts for ledgers with outstanding balances to reduce delay times.</p>
            </article>
            <article className={styles.showcaseCard}>
              <div className={styles.showcaseIcon}>
                <Shield className="h-6 w-6" />
              </div>
              <h3>Ledger Statements</h3>
              <p>Let clients request their balance and ledger statements by typing a keyword on WhatsApp.</p>
            </article>
            <article className={styles.showcaseCard}>
              <div className={styles.showcaseIcon}>
                <Zap className="h-6 w-6" />
              </div>
              <h3>Payment Receipts</h3>
              <p>Instantly confirm transactions by auto-sending WhatsApp payment receipts as soon as vouchers are recorded.</p>
            </article>
          </div>
        </div>
      </section>

      {/* NEW: Manual vs TallyKonnect Comparison Section */}
      <section className={styles.comparisonSection}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Why TallyKonnect?</span>
            <h2>Automate the <span>Heavy Lifting</span></h2>
          </div>
          <div className={styles.comparisonGrid}>
            <div className={`${styles.comparisonCol} ${styles.manual}`}>
              <h3>Manual WhatsApp Reminders</h3>
              <ul className={styles.comparisonList}>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Manually export PDF files and invoice sheets from Tally one-by-one.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Save client phone numbers on a physical mobile phone list to message them.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Type out templates manually, upload attachments, and click send.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Takes 5 to 10 minutes per reminder. Impossible to scale.</span>
                </li>
              </ul>
            </div>
            <div className={`${styles.comparisonCol} ${styles.automated}`}>
              <h3>TallyKonnect Automation</h3>
              <ul className={styles.comparisonList}>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Automated background connector pulls invoices from Tally instantly.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Send messages directly using Meta API without saving any numbers to a phone.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Pre-approved official templates are sent with a single click or automatically.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Takes less than 5 seconds. Send thousands of reminders at once.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.testimonials}>
        <div className={styles.testimonialsContainer}>
          <div>
            <span className={styles.kicker}>What our clients say</span>
            <h2>Loved by businesses, trusted for results</h2>
          </div>
          {testimonials.map(([name, company, quote]) => (
            <article className={styles.testimonialCard} key={name}>
              <span className={styles.stars}>5 star rating</span>
              <p>{quote}</p>
              <strong>{name}</strong>
              <small>{company}</small>
            </article>
          ))}
        </div>
      </section>

      {/* NEW: FAQ Section */}
      <section className={styles.faqSection}>
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Frequently Asked Questions</span>
            <h2>Got Questions? <span>We Have Answers</span></h2>
          </div>
          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <h3>How does the Tally integration work?</h3>
              <p>We provide a secure, lightweight connector that runs alongside your Tally ERP installation. It reads ledger balances and invoice details and pushes them securely to TallyKonnect to trigger updates.</p>
            </div>
            <div className={styles.faqCard}>
              <h3>Do I need a WhatsApp Business API account?</h3>
              <p>Yes. TallyKonnect uses the official Meta Cloud API to ensure delivery rates and prevent number bans. We provide embedded onboarding inside our app to help you set it up in under 5 minutes.</p>
            </div>
            <div className={styles.faqCard}>
              <h3>Can I use my existing WhatsApp phone number?</h3>
              <p>Yes, you can register your current number. However, you must first disconnect it from normal mobile/web WhatsApp apps so it can connect to the Cloud API.</p>
            </div>
            <div className={styles.faqCard}>
              <h3>Is my financial data safe and secure?</h3>
              <p>Data security is our top priority. We only sync data points that are necessary for generating templates and reminders. All information is encrypted in transit and at rest.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionContainer}>
          <div className={styles.sectionHeading}>
            <span className={styles.kicker}>Simple pricing</span>
            <h2>Choose the plan that fits your business</h2>
          </div>
          <div className={styles.pricingGrid}>
            {plans.map((plan, index) => (
              <article className={`${styles.planCard} ${index === 1 ? styles.popularPlan : ''}`} key={plan.name}>
                {index === 1 && <span className={styles.popularBadge}>Most Popular</span>}
                <h3>{plan.name}</h3>
                <strong>
                  {plan.price}
                  <small>/month</small>
                </strong>
                <p>{plan.detail}</p>
                <ul>
                  {plan.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link className={styles.primaryButton} href="/sign-up">
                  Start Free Trial
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaSectionContainer}>
          <div className={styles.ctaIcon}>WA</div>
          <div>
            <h2>Ready to automate your business with WhatsApp and Tally?</h2>
            <p>Start your 14-day free trial today. No credit card required.</p>
          </div>
          <Link className={styles.secondaryButton} href="/sign-up">
            Start Free Trial
          </Link>
        </div>
      </section>

      <footer className={styles.footer} id="footer">
        <div className={styles.footerContainer}>
          <div>
            <Link className={styles.footerBrand} href="/">
              <span className={styles.brandMark}>TK</span>
              <span>TallyKonnect</span>
            </Link>
            <p>Automate WhatsApp. Manage business. Integrate with Tally. Grow more.</p>
          </div>
          <div>
            <strong>Product</strong>
            <Link href="#features">Features</Link>
            <Link href="#integrations">Integrations</Link>
            <Link href="#pricing">Pricing</Link>
          </div>
          <div>
            <strong>Company</strong>
            <Link href="/sign-in">Login</Link>
            <Link href="/sign-up">Start Free Trial</Link>
            <Link href="#footer">Contact Us</Link>
          </div>
          <div>
            <strong>Legal</strong>
            <Link href="#footer">Privacy Policy</Link>
            <Link href="#footer">Terms of Service</Link>
            <Link href="#footer">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
