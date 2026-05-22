import UIKit

final class SampleDetailViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        title = "Detail"
        view.backgroundColor = Theme.background
        navigationItem.largeTitleDisplayMode = .always

        let card = UIView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = Theme.cardBackground
        card.layer.cornerRadius = 16
        card.layer.cornerCurve = .continuous

        let iconView = UIImageView(image: UIImage(systemName: "doc.text.fill"))
        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.tintColor = Theme.heroIconTint
        iconView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 36, weight: .bold)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        titleLabel.textColor = Theme.primaryText
        titleLabel.numberOfLines = 0
        titleLabel.text = "Detail screen"

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = .systemFont(ofSize: 15, weight: .medium)
        subtitleLabel.textColor = Theme.tertiaryText
        subtitleLabel.numberOfLines = 0
        subtitleLabel.text = "Geri dönerken story bar geçiş animasyonunda görsel bozulma olup olmadığını gözlemleyin."

        let stack = UIStackView(arrangedSubviews: [iconView, titleLabel, subtitleLabel])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 16
        stack.alignment = .leading

        card.addSubview(stack)
        view.addSubview(card)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -24),
        ])
    }
}
