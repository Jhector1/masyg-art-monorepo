"use client";

import SEO from "@acme/ui/components/SEO";
import { useState } from "react";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "", website: "" }); // website = honeypot
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send");
      setStatus({ ok: true, msg: "Message sent! We’ll get back to you soon." });
      setFormData({ name: "", email: "", message: "", website: "" });
    } catch (err: any) {
      setStatus({ ok: false, msg: err.message || "Something went wrong." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO title="Haitian Digital Art Gallery" description="Buy and explore uniquely crafted Haitian vector artworks." />
      <main className="min-h-screen flex items-center justify-center  py-12">
        <div className="max-w-6xl w-full bg-white shadow-2xl rounded-3xl p-8 md:p-12 grid md:grid-cols-2 gap-10">
          {/* Left */}
          <div className="space-y-6">
            <h2 className="text-4xl font-bold text-gray-900">Get in Touch</h2>
            <p className="text-gray-600">
              We&apos;d love to hear from you! Whether it&apos;s a question, feedback, or just to say hi — feel free to reach out.
            </p>
            <div className="space-y-4">
              <ContactInfo icon="✉️" text="info@ziledigital.com" />
            </div>
          </div>

          {/* Right */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Honeypot field (hidden) */}
            <input
              type="text"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            <div>
              <label className="block text-sm font-medium">Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Your Email</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Message</label>
              <textarea
                name="message"
                rows={4}
                required
                value={formData.message}
                onChange={handleChange}
                className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send Message"}
            </button>

            {status && (
              <p className={`text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>
                {status.msg}
              </p>
            )}
          </form>
        </div>
      </main>
    </>
  );
}

function ContactInfo({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-2xl">{icon}</span>
      <span className="text-gray-700">{text}</span>
    </div>
  );
}
